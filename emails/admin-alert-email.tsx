import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

const COLOR_NAVY = "#0C2142";
const COLOR_CREAM = "#F5F0E6";

/** Plain alert sent to the site owner (new contact message, failed payment check, and so on). */
export default function AdminAlertEmail({ title, body }: { title: string; body: string }) {
  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Body style={{ backgroundColor: COLOR_CREAM, fontFamily: "Arial, Helvetica, sans-serif", margin: 0, padding: "32px 0" }}>
        <Container style={{ backgroundColor: "#FFFFFF", borderRadius: "8px", margin: "0 auto", maxWidth: "520px", padding: "32px" }}>
          <Heading style={{ color: COLOR_NAVY, fontSize: "20px", margin: "0 0 16px" }}>{title}</Heading>
          <Text style={{ color: COLOR_NAVY, fontSize: "15px", lineHeight: "24px", margin: 0, whiteSpace: "pre-wrap" }}>{body}</Text>
        </Container>
      </Body>
    </Html>
  );
}
