/**
 * `@preline/pin-input` ships type declarations only for its default
 * (auto-init) entry (`node_modules/@preline/pin-input/index.d.ts`) — the
 * manual-init `non-auto` entry used by `components/auth/TwoFactorModal.tsx`
 * has no `non-auto.d.ts` in the published package (verified against the
 * installed 5.0.0 package contents). Both entries export the same
 * `HSPinInput` class (per the package's own README), so this just points
 * the manual entry's types at the already-typed default export instead of
 * falling back to `any`.
 */
declare module "@preline/pin-input/non-auto" {
  import HSPinInput from "@preline/pin-input";
  export default HSPinInput;
}
