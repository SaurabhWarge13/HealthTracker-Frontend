/**
 * A check-in's id is minted here, on the device, at the moment it is created —
 * possibly offline — and the server stores it as the row's primary key. There is
 * no second, server-assigned identity and nothing to map between.
 *
 * That makes collision resistance matter: a clash with an id another account
 * already owns is rejected by the server as a conflict. 122 random bits puts
 * that out of reach.
 *
 * `Math.random` rather than a crypto source is deliberate. These ids need to be
 * unique, not unguessable — every read and write is scoped by the caller's user
 * id server-side, so knowing someone else's id grants nothing. Avoiding
 * `react-native-get-random-values` keeps a native module out of the build.
 */
const HEX = '0123456789abcdef';

const hex = (length: number): string => {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += HEX[Math.floor(Math.random() * 16)];
  }
  return out;
};

// UUID v4 shape: 8-4-4-4-12, with the version nibble and the variant bits fixed.
export const createId = (): string =>
  `${hex(8)}-${hex(4)}-4${hex(3)}-${HEX[8 + Math.floor(Math.random() * 4)]}${hex(
    3,
  )}-${hex(12)}`;
