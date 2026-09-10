package com.healthtracker

import android.os.Bundle
import android.os.SystemClock
import android.view.ViewGroup
import android.view.ViewTreeObserver
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    // Hand the splash theme back to AppTheme. Must run before super.onCreate():
    // AppCompat resolves theme attributes while installing the decor view.
    setTheme(R.style.AppTheme)
    super.onCreate(savedInstanceState)
    holdSplashUntilReactContentIsRendered()
    // Required by react-native-health-connect so the permission result
    // can be routed back to the JS side.
    HealthConnectPermissionDelegate.setPermissionDelegate(this)
  }

  /**
   * Keeps the launch splash up until React Native has mounted something.
   *
   * The platform tears the splash down — the API 31+ system splash, or the pre-31
   * starting window — as soon as this activity draws its first frame. React Native
   * calls setContentView() inside super.onCreate(), so without this that first frame
   * is an empty root view drawn seconds before the JS bundle has been evaluated,
   * which is the blank window between the logo and the first screen.
   *
   * Suspending the pre-draw pass holds that first frame back. It adds no delay of
   * its own, and [SPLASH_HOLD_TIMEOUT_MS] caps how long it can ever wait so a
   * failed or unusually slow startup can never leave the splash stuck on screen.
   */
  private fun holdSplashUntilReactContentIsRendered() {
    val content = findViewById<ViewGroup>(android.R.id.content)
    val giveUpAt = SystemClock.uptimeMillis() + SPLASH_HOLD_TIMEOUT_MS
    content.viewTreeObserver.addOnPreDrawListener(
        object : ViewTreeObserver.OnPreDrawListener {
          override fun onPreDraw(): Boolean {
            // setContentView() made the React root view the content view's only
            // child; it stays childless until React Native mounts its first tree.
            val reactRoot = content.getChildAt(0) as? ViewGroup
            val ready = reactRoot != null && reactRoot.childCount > 0
            if (!ready && SystemClock.uptimeMillis() < giveUpAt) {
              return false // Skip this frame; the splash stays up.
            }
            content.viewTreeObserver.removeOnPreDrawListener(this)
            return true
          }
        })
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "HealthTracker"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  private companion object {
    /** Failsafe ceiling: never hold the splash longer than this, whatever happens. */
    const val SPLASH_HOLD_TIMEOUT_MS = 5_000L
  }
}
