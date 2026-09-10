#!/usr/bin/env swift
//
// Generates every Android and iOS launcher-icon / splash asset from the single
// master logo at assets/brand/logo.png.
//
//   swift scripts/generate-app-assets.swift [repoRoot]
//
// This is a one-shot developer utility in the same spirit as `react-native-asset`
// for the fonts — nothing in Gradle, Xcode or Metro references it. Re-run it if the
// master logo ever changes.
//
// It uses CoreGraphics rather than ImageMagick/sharp so it needs no dependency at
// all beyond the Xcode toolchain. Every draw is aspect-fit onto a centred canvas,
// so the logo is never stretched or cropped.
//

import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

// MARK: - Plumbing

func die(_ message: String) -> Never {
  FileHandle.standardError.write(Data("error: \(message)\n".utf8))
  exit(1)
}

let sRGB = CGColorSpace(name: CGColorSpace.sRGB)!

func loadImage(_ path: String) -> CGImage {
  guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
    let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
  else { die("could not read \(path)") }
  return image
}

/// RGBA, premultiplied — for anything that keeps transparency.
func transparentContext(_ size: Int) -> CGContext {
  guard
    let ctx = CGContext(
      data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: size * 4,
      space: sRGB,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        | CGBitmapInfo.byteOrder32Big.rawValue)
  else { die("could not create \(size)x\(size) RGBA context") }
  ctx.interpolationQuality = .high
  return ctx
}

/// No alpha channel at all — iOS app icons are rejected by App Store validation if
/// they carry one, so these are rendered into a `noneSkipLast` context.
func opaqueContext(_ size: Int) -> CGContext {
  guard
    let ctx = CGContext(
      data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: size * 4,
      space: sRGB,
      bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue)
  else { die("could not create \(size)x\(size) opaque context") }
  ctx.interpolationQuality = .high
  return ctx
}

func writePNG(_ image: CGImage, to path: String) {
  let url = URL(fileURLWithPath: path)
  try? FileManager.default.createDirectory(
    at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
  guard
    let dest = CGImageDestinationCreateWithURL(
      url as CFURL, UTType.png.identifier as CFString, 1, nil)
  else { die("could not create destination \(path)") }
  CGImageDestinationAddImage(dest, image, nil)
  guard CGImageDestinationFinalize(dest) else { die("could not write \(path)") }
}

/// Crops the fully transparent margin off the master so padding is controlled here
/// rather than inherited from however the logo was exported.
func trimTransparentEdges(_ image: CGImage) -> CGImage {
  let w = image.width, h = image.height
  guard
    let square = CGContext(
      data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: sRGB,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        | CGBitmapInfo.byteOrder32Big.rawValue)
  else { die("could not create scan context") }
  square.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
  guard let buffer = square.data else { die("no bitmap data while trimming") }
  let px = buffer.bindMemory(to: UInt8.self, capacity: w * h * 4)

  var minX = w, minY = h, maxX = -1, maxY = -1
  for y in 0..<h {
    for x in 0..<w where px[(y * w + x) * 4 + 3] > 8 {
      if x < minX { minX = x }
      if x > maxX { maxX = x }
      if y < minY { minY = y }
      if y > maxY { maxY = y }
    }
  }
  guard maxX >= minX, maxY >= minY else { return image }
  let rect = CGRect(x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1)
  return image.cropping(to: rect) ?? image
}

func smoothstep(_ edge0: Double, _ edge1: Double, _ x: Double) -> Double {
  let t = min(max((x - edge0) / (edge1 - edge0), 0), 1)
  return t * t * (3 - 2 * t)
}

/// How far the logo's centre of mass sits from the centre of its bounding box,
/// as a fraction of height (negative = mass sits above the box centre).
///
/// A heart is wide at the top and tapers to a point, so box-centring leaves it
/// looking top-heavy. Centring on mass instead is what makes an app icon read as
/// centred at small sizes. Measured rather than hard-coded, so it stays right if
/// the logo is ever replaced.
func verticalMassOffset(_ image: CGImage) -> Double {
  let w = image.width, h = image.height
  guard
    let ctx = CGContext(
      data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: sRGB,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        | CGBitmapInfo.byteOrder32Big.rawValue)
  else { die("could not create centroid context") }
  ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
  guard let buffer = ctx.data else { die("no bitmap data while measuring mass") }
  let px = buffer.bindMemory(to: UInt8.self, capacity: w * h * 4)

  var totalAlpha = 0.0
  var weightedY = 0.0
  for y in 0..<h {
    for x in 0..<w {
      let a = Double(px[(y * w + x) * 4 + 3]) / 255.0
      if a > 0.03 {
        totalAlpha += a
        weightedY += Double(y) * a
      }
    }
  }
  guard totalAlpha > 0 else { return 0 }
  return (weightedY / totalAlpha - Double(h) / 2.0) / Double(h)
}

// MARK: - Rendering

/// Set once the master is loaded; consumed by `opticalCentre` renders.
var massOffset: Double = 0

/// Fraction of the mass offset actually applied. Correcting the whole way
/// overshoots — a heart's pointed base means the eye splits the difference
/// between the box centre and the centre of mass — so we move half of it.
let massCorrection = 0.5

enum Plate {
  case fill
  case rounded(Double)  // corner radius as a fraction of the canvas
  case circle
}

/// - Parameters:
///   - logoFraction: the logo's bounding box as a fraction of the canvas edge.
///   - background:   nil keeps the canvas transparent.
///   - monochrome:   flatten to a black silhouette, knocking the near-white ECG line
///                   back out, for Android 13+ themed icons.
func render(
  _ source: CGImage,
  canvas: Int,
  logoFraction: Double,
  background: (Double, Double, Double)? = nil,
  plate: Plate = .fill,
  monochrome: Bool = false,
  opaque: Bool = false,
  opticalCentre: Bool = false,
  to path: String
) {
  let ctx = opaque ? opaqueContext(canvas) : transparentContext(canvas)
  let full = CGRect(x: 0, y: 0, width: canvas, height: canvas)

  if let bg = background {
    ctx.saveGState()
    switch plate {
    case .fill:
      break
    case .rounded(let fraction):
      let radius = CGFloat(fraction) * CGFloat(canvas)
      ctx.addPath(
        CGPath(roundedRect: full, cornerWidth: radius, cornerHeight: radius, transform: nil))
      ctx.clip()
    case .circle:
      ctx.addEllipse(in: full)
      ctx.clip()
    }
    ctx.setFillColor(red: CGFloat(bg.0), green: CGFloat(bg.1), blue: CGFloat(bg.2), alpha: 1)
    ctx.fill(full)
    ctx.restoreGState()
  }

  // Aspect-fit, centred. Never stretched, never cropped.
  let box = CGFloat(logoFraction) * CGFloat(canvas)
  let sw = CGFloat(source.width), sh = CGFloat(source.height)
  let scale = min(box / sw, box / sh)
  let dw = sw * scale, dh = sh * scale
  // Shift down by however far the mass sits above the box centre. The context's
  // y axis points up, hence the negation.
  let nudge = opticalCentre ? -CGFloat(massOffset * massCorrection) * dh : 0
  ctx.draw(
    source,
    in: CGRect(
      x: (CGFloat(canvas) - dw) / 2, y: (CGFloat(canvas) - dh) / 2 + nudge, width: dw,
      height: dh))

  if monochrome, let buffer = ctx.data {
    let px = buffer.bindMemory(to: UInt8.self, capacity: canvas * canvas * 4)
    for i in stride(from: 0, to: canvas * canvas * 4, by: 4) {
      let a = Double(px[i + 3]) / 255.0
      defer {
        px[i] = 0
        px[i + 1] = 0
        px[i + 2] = 0
      }
      guard a > 0 else { continue }
      let r = Double(px[i]) / 255.0 / a
      let g = Double(px[i + 1]) / 255.0 / a
      let b = Double(px[i + 2]) / 255.0 / a
      let luma = 0.299 * r + 0.587 * g + 0.114 * b
      let newAlpha = a * (1.0 - smoothstep(0.82, 0.96, luma))
      px[i + 3] = UInt8(max(0, min(255, (newAlpha * 255).rounded())))
    }
  }

  guard let out = ctx.makeImage() else { die("makeImage failed for \(path)") }
  writePNG(out, to: path)
  print("  \(canvas)x\(canvas)  \(path)")
}

// MARK: - Driver

let repoRoot =
  CommandLine.arguments.count > 1
  ? CommandLine.arguments[1] : FileManager.default.currentDirectoryPath
let master = loadImage("\(repoRoot)/assets/brand/logo.png")
let logo = trimTransparentEdges(master)
massOffset = verticalMassOffset(logo)
print("master \(master.width)x\(master.height) -> trimmed \(logo.width)x\(logo.height)")
print(String(format: "mass sits %.2f%% above box centre; app icons nudged down %.2f%%",
             -massOffset * 100, -massOffset * massCorrection * 100))

let white = (1.0, 1.0, 1.0)
let densities: [(name: String, scale: Double)] = [
  ("mdpi", 1), ("hdpi", 1.5), ("xhdpi", 2), ("xxhdpi", 3), ("xxxhdpi", 4),
]
let res = "\(repoRoot)/android/app/src/main/res"

print("\nandroid launcher icons")
for (name, scale) in densities {
  let adaptive = Int(108 * scale)  // 108dp adaptive canvas
  let legacy = Int(48 * scale)  // 48dp legacy canvas

  // 56dp inside the 108dp canvas. The safe zone is a 72dp-diameter *circle*, and
  // this logo is wide relative to its height: at 64dp the heart's shoulders landed
  // exactly on that rim, so a round-mask launcher sliced them flat. 56dp keeps the
  // whole mark at ~88% of the circle, clear of every mask shape.
  render(
    logo, canvas: adaptive, logoFraction: 56.0 / 108.0, opticalCentre: true,
    to: "\(res)/mipmap-\(name)/ic_launcher_foreground.png")
  // Themed icons (API 33+) draw the glyph on a solid tinted disc, where a
  // full-size mark reads as cramped — so the silhouette is a touch smaller.
  render(
    logo, canvas: adaptive, logoFraction: 56.0 / 108.0, monochrome: true, opticalCentre: true,
    to: "\(res)/mipmap-\(name)/ic_launcher_monochrome.png")

  // Pre-API-26 fallbacks. minSdk is 26 so these are belt-and-braces, but they are
  // currently the default React Native artwork and must not be left behind.
  render(
    logo, canvas: legacy, logoFraction: 0.72, background: white, plate: .rounded(0.20),
    opticalCentre: true, to: "\(res)/mipmap-\(name)/ic_launcher.png")
  render(
    logo, canvas: legacy, logoFraction: 0.66, background: white, plate: .circle,
    opticalCentre: true, to: "\(res)/mipmap-\(name)/ic_launcher_round.png")
}

print("\nandroid splash")
for (name, scale) in densities {
  // One asset serves both splash paths. 288dp canvas with the logo at 176dp:
  // the padding is baked in so the mark lands inside the API 31+ system-splash
  // 192dp safe circle, and the pre-31 layer-list draws the same bitmap centred
  // at its intrinsic size, which looks identical.
  render(
    logo, canvas: Int(288 * scale), logoFraction: 176.0 / 288.0,
    to: "\(res)/drawable-\(name)/splash_logo.png")
}

// Single-size app icon (Xcode 14+): actool derives every iPhone, iPad, Settings,
// Spotlight and Notification rendition from this one master. That matters here
// because TARGETED_DEVICE_FAMILY is "1,2" (universal) while the old legacy
// 9-slot catalog had no iPad slots at all.
//
// Opaque with the alpha channel stripped, full-bleed square, no rounded corners
// and no shadow — iOS applies its own superellipse mask, and a transparent icon
// is rejected at upload as ITMS-90717.
print("\nios app icon (opaque, no alpha channel)")
render(
  logo, canvas: 1024, logoFraction: 0.80, background: white, plate: .fill, opaque: true,
  opticalCentre: true,
  to: "\(repoRoot)/ios/HealthTracker/Images.xcassets/AppIcon.appiconset/Icon-1024.png")

print("\nios launch logo")
let launchLogo = "\(repoRoot)/ios/HealthTracker/Images.xcassets/LaunchLogo.imageset"
for (size, filename) in [(160, "logo.png"), (320, "logo@2x.png"), (480, "logo@3x.png")] {
  render(logo, canvas: size, logoFraction: 1.0, to: "\(launchLogo)/\(filename)")
}

print("\ndone")
