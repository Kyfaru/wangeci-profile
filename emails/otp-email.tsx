import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

import { OTP_TTL_SECONDS } from "@/lib/auth/constants";

// Brand colours are inlined: email clients strip <style> blocks and ignore CSS variables.
const COLOR_NAVY = "#0C2142";
const COLOR_GOLD = "#D4A616";
const COLOR_CREAM = "#F5F0E6";

export interface OtpEmailProps {
  code: string;
}

/** The one-time sign-in / verification code email. */
export default function OtpEmail({ code }: OtpEmailProps) {
  const minutes = OTP_TTL_SECONDS / 60;
  return (
    <Html>
      <Head />
      <Preview>{`Your Wangeci code is ${code}`}</Preview>
      <Body style={{ backgroundColor: COLOR_CREAM, fontFamily: "Arial, Helvetica, sans-serif", margin: 0, padding: "32px 0" }}>
        <Container style={{ backgroundColor: "#FFFFFF", borderRadius: "8px", margin: "0 auto", maxWidth: "480px", padding: "40px 32px" }}>
          <Heading style={{ color: COLOR_NAVY, fontSize: "22px", margin: "0 0 16px" }}>Your verification code</Heading>
          <Text style={{ color: COLOR_NAVY, fontSize: "15px", lineHeight: "24px", margin: "0 0 24px" }}>
            Enter this code to continue. It expires in {minutes} minutes.
          </Text>
          <Text style={{ color: COLOR_GOLD, fontSize: "36px", fontWeight: "bold", letterSpacing: "12px", margin: "0 0 24px" }}>{code}</Text>
          <Text style={{ color: "#6B7280", fontSize: "12px", lineHeight: "18px", margin: "32px 0 0" }}>
            Never share this code. If you did not ask for it, you can ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
