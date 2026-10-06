import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

const COLOR_NAVY = "#0C2142";
const COLOR_CREAM = "#F5F0E6";

export interface ReceiptEmailProps {
  titles: string[];
  total: string;
  reference: string;
  invoiceNumber?: string;
  email?: string;
  phone?: string | null;
  dashboardUrl?: string;
  signInUrl?: string;
}

const p = { color: COLOR_NAVY, fontSize: "15px", lineHeight: "24px", margin: "0 0 8px" } as const;

/** Payment receipt and "how to sign in" guide. Sent after the provider confirmed the payment and the books are on the account. */
export default function ReceiptEmail({ titles, total, reference, invoiceNumber, email, phone, dashboardUrl, signInUrl }: ReceiptEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your Wangeci order is confirmed</Preview>
      <Body style={{ backgroundColor: COLOR_CREAM, fontFamily: "Arial, Helvetica, sans-serif", margin: 0, padding: "32px 0" }}>
        <Container style={{ backgroundColor: "#FFFFFF", borderRadius: "8px", margin: "0 auto", maxWidth: "480px", padding: "40px 32px" }}>
          <Heading style={{ color: COLOR_NAVY, fontSize: "22px", margin: "0 0 16px" }}>Thank you, your order is confirmed</Heading>
          {titles.map((t) => (
            <Text key={t} style={{ ...p, margin: "0 0 4px" }}>
              {t}
            </Text>
          ))}
          <Text style={{ ...p, fontWeight: "bold", margin: "16px 0 0" }}>Total: {total}</Text>
          <Text style={{ color: "#6B7280", fontSize: "12px", margin: "8px 0 0" }}>
            Payment reference: {reference}
            {invoiceNumber ? ` · Invoice ${invoiceNumber} (attached as a PDF)` : ""}
          </Text>

          <Text style={{ ...p, margin: "24px 0 8px" }}>Your books are now in your account.</Text>
          {dashboardUrl && (
            <Button href={dashboardUrl} style={{ backgroundColor: COLOR_NAVY, borderRadius: "40px", color: "#FFFFFF", fontSize: "15px", padding: "12px 28px", textDecoration: "none" }}>
              Go to my dashboard
            </Button>
          )}

          <Heading as="h2" style={{ color: COLOR_NAVY, fontSize: "16px", margin: "28px 0 8px" }}>
            How to sign in next time
          </Heading>
          <Text style={p}>There is no password to remember. Open the sign-in page{signInUrl ? ` (${signInUrl})` : ""} and:</Text>
          <Text style={p}>1. Enter {email ? <strong>{email}</strong> : "the email you used at checkout"}{phone ? <> or the phone number <strong>{phone}</strong></> : null}.</Text>
          <Text style={p}>2. We send a 4-digit code to that email or phone.</Text>
          <Text style={p}>3. Enter the code and you are in.</Text>
          <Text style={{ color: "#6B7280", fontSize: "12px", margin: "16px 0 0" }}>You can only be signed in on one device at a time. Signing in on a new device signs out the old one.</Text>
        </Container>
      </Body>
    </Html>
  );
}
