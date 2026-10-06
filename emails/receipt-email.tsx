import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

const COLOR_NAVY = "#0C2142";
const COLOR_CREAM = "#F5F0E6";

export interface ReceiptEmailProps {
  titles: string[];
  total: string;
  reference: string;
}

/** Payment receipt. Sent after the payment is confirmed by the provider and the books are on the account. */
export default function ReceiptEmail({ titles, total, reference }: ReceiptEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your Wangeci order is confirmed</Preview>
      <Body style={{ backgroundColor: COLOR_CREAM, fontFamily: "Arial, Helvetica, sans-serif", margin: 0, padding: "32px 0" }}>
        <Container style={{ backgroundColor: "#FFFFFF", borderRadius: "8px", margin: "0 auto", maxWidth: "480px", padding: "40px 32px" }}>
          <Heading style={{ color: COLOR_NAVY, fontSize: "22px", margin: "0 0 16px" }}>Thank you, your order is confirmed</Heading>
          {titles.map((t) => (
            <Text key={t} style={{ color: COLOR_NAVY, fontSize: "15px", lineHeight: "24px", margin: "0 0 4px" }}>
              {t}
            </Text>
          ))}
          <Text style={{ color: COLOR_NAVY, fontSize: "15px", fontWeight: "bold", margin: "16px 0 0" }}>Total: {total}</Text>
          <Text style={{ color: "#6B7280", fontSize: "12px", margin: "8px 0 0" }}>Payment reference: {reference}</Text>
          <Text style={{ color: COLOR_NAVY, fontSize: "15px", lineHeight: "24px", margin: "24px 0 0" }}>Your books are now in My Books on your account.</Text>
        </Container>
      </Body>
    </Html>
  );
}
