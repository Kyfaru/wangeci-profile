/** Sign-in code settings. Change OTP_LENGTH here and nowhere else (the Figma boxes show 4). */
export const OTP_LENGTH = 4;
export const OTP_TTL_SECONDS = 5 * 60;
/** Wrong guesses allowed on one code before it is burned. */
export const OTP_ATTEMPTS_PER_CODE = 5;
