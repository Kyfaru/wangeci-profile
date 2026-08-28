"use client";

/**
 * DEV-ONLY SCRATCH PAGE — safe to delete before launch.
 *
 * Visual QA surface for the design-token foundation: color palette, type
 * scale (both fonts, all weights), and every `components/ui` primitive in
 * its variants. Check at http://localhost:3000/style-guide, ideally at a
 * 1440px viewport to match the Figma frame.
 *
 * The country data below is throwaway sample data for this page only —
 * it is NOT `lib/countries.json` (that file is owned by a parallel
 * workstream and this component library never imports it directly).
 */
import { useState } from "react";
import {
  Avatar,
  AvatarStack,
  Button,
  Card,
  Checkbox,
  CountrySelect,
  FormField,
  IconButton,
  Input,
  OAuthButtonRow,
  PhoneInput,
  ProgressBar,
  RatingBadge,
  SectionHeading,
  Select,
  StarIcon,
  StatChip,
  Textarea,
  type CountryOption,
} from "@/components/ui";

const SAMPLE_COUNTRIES: CountryOption[] = [
  { name: "Kenya", iso2: "KE", dialCode: "+254", flag: "🇰🇪" },
  { name: "Uganda", iso2: "UG", dialCode: "+256", flag: "🇺🇬" },
  { name: "United States", iso2: "US", dialCode: "+1", flag: "🇺🇸" },
  { name: "United Kingdom", iso2: "GB", dialCode: "+44", flag: "🇬🇧" },
];

const SAMPLE_STATES = [
  { label: "Nairobi", value: "nairobi" },
  { label: "Mombasa", value: "mombasa" },
  { label: "Kisumu", value: "kisumu" },
];

const PALETTE = [
  { name: "navy", hex: "#0c2142", swatchText: "text-cream" },
  { name: "gold", hex: "#d4a616", swatchText: "text-navy" },
  { name: "gold-bright", hex: "#fdc105", swatchText: "text-navy" },
  { name: "cream", hex: "#f5f0e6", swatchText: "text-navy" },
  { name: "green", hex: "#025936", swatchText: "text-cream" },
  { name: "gray", hex: "#8c8c8c", swatchText: "text-white" },
  { name: "gray-light", hex: "#f6f6f6", swatchText: "text-navy" },
  { name: "black", hex: "#000000", swatchText: "text-white" },
  { name: "white", hex: "#ffffff", swatchText: "text-navy" },
  { name: "error", hex: "#b3261e", swatchText: "text-white" },
] as const;

const AEONIK_WEIGHTS = [
  { label: "Light 300", className: "font-light" },
  { label: "Regular 400", className: "font-normal" },
  { label: "Medium 500", className: "font-medium" },
  { label: "Bold 700", className: "font-bold" },
];

function Swatch({
  name,
  hex,
  swatchText,
}: (typeof PALETTE)[number]) {
  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-navy/10">
      <div
        className={`flex h-20 items-end p-3 font-mono text-xs ${swatchText}`}
        style={{ backgroundColor: hex }}
      >
        {hex}
      </div>
      <div className="bg-white px-3 py-2 text-sm font-medium text-navy">
        {name}
      </div>
    </div>
  );
}

function Subsection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold tracking-[0.15em] text-gray uppercase">
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function StyleGuidePage() {
  const [countryIso2, setCountryIso2] = useState("KE");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [checked, setChecked] = useState(true);
  const [inputValue, setInputValue] = useState("");

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-16 px-8 py-16">
      <header className="flex flex-col gap-2">
        <span className="text-sm font-semibold tracking-[0.2em] text-gold-bright uppercase">
          Dev only
        </span>
        <h1 className="font-display text-4xl text-navy">
          Wangechi Kariuki — Style Guide
        </h1>
        <p className="max-w-2xl text-gray">
          Design-token foundation and UI primitive library. This route is a
          throwaway QA scratch page — safe to delete before launch.
        </p>
      </header>

      {/* Color palette */}
      <section className="flex flex-col gap-6">
        <SectionHeading eyebrow="Foundations" as="h2">
          Color palette
        </SectionHeading>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {PALETTE.map((color) => (
            <Swatch key={color.name} {...color} />
          ))}
        </div>
      </section>

      {/* Type scale */}
      <section className="flex flex-col gap-8">
        <SectionHeading eyebrow="Foundations" as="h2">
          Type scale
        </SectionHeading>

        <Subsection title="Wayfinding Sans ExN — display / headline">
          <div className="flex flex-col gap-3">
            <p className="font-display text-5xl text-navy">
              From Pieces To Power
            </p>
            <p className="font-display text-3xl text-navy">
              From Pieces To Power
            </p>
            <p className="font-display text-xl text-navy">
              From Pieces To Power
            </p>
          </div>
        </Subsection>

        <Subsection title="Aeonik — body / UI (4 weights)">
          <div className="flex flex-col gap-2">
            {AEONIK_WEIGHTS.map((weight) => (
              <p
                key={weight.label}
                className={`font-body text-lg text-navy ${weight.className}`}
              >
                {weight.label} — The quick brown fox jumps over the lazy dog.
              </p>
            ))}
          </div>
        </Subsection>
      </section>

      {/* Buttons */}
      <section className="flex flex-col gap-6">
        <SectionHeading eyebrow="Primitives" as="h2">
          Buttons &amp; icon buttons
        </SectionHeading>
        <Subsection title="Button variants">
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
            <Button variant="primary" loading>
              Loading
            </Button>
          </div>
        </Subsection>
        <Subsection title="Sizes">
          <div className="flex flex-wrap items-center gap-4">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
        </Subsection>
        <Subsection title="Icon buttons">
          <div className="flex flex-wrap items-center gap-4">
            <IconButton
              aria-label="Like"
              variant="solid"
              icon={<StarIcon />}
            />
            <IconButton
              aria-label="Like"
              variant="outline"
              icon={<StarIcon />}
            />
            <IconButton
              aria-label="Like"
              variant="ghost"
              icon={<StarIcon />}
            />
          </div>
        </Subsection>
      </section>

      {/* Cards, badges, chips, progress */}
      <section className="flex flex-col gap-6">
        <SectionHeading eyebrow="Primitives" as="h2">
          Cards, badges, chips &amp; progress
        </SectionHeading>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card>
            <p className="mb-2 font-display text-xl text-navy">
              From Pieces To Power
            </p>
            <p className="mb-4 text-sm text-gray">
              A memoir on rebuilding after loss.
            </p>
            <div className="flex items-center gap-3">
              <RatingBadge rating={4.8} count={128} />
              <StatChip icon={<StarIcon />} count="1.2k" label="readers" />
            </div>
          </Card>
          <Card interactive>
            <p className="mb-2 text-sm font-medium text-gray">Interactive card</p>
            <p className="text-navy">Hover to see the shadow lift.</p>
          </Card>
          <Card>
            <ProgressBar label="Chapter 3 of 10" value={30} showValue />
            <div className="mt-4">
              <ProgressBar variant="green" value={70} size="sm" />
            </div>
            <div className="mt-4">
              <ProgressBar variant="navy" value={45} size="sm" />
            </div>
          </Card>
        </div>
      </section>

      {/* Avatars */}
      <section className="flex flex-col gap-6">
        <SectionHeading eyebrow="Primitives" as="h2">
          Avatars
        </SectionHeading>
        <div className="flex flex-wrap items-center gap-6">
          <Avatar alt="Felister Kariuki" size="xl" />
          <Avatar alt="Felister Kariuki" size="lg" />
          <Avatar alt="Felister Kariuki" size="md" />
          <Avatar alt="Felister Kariuki" size="sm" />
          <AvatarStack
            avatars={[
              { alt: "Jane W" },
              { alt: "Kevin O" },
              { alt: "Amina H" },
              { alt: "Peter M" },
              { alt: "Grace N" },
            ]}
          />
        </div>
      </section>

      {/* Forms */}
      <section className="flex flex-col gap-6">
        <SectionHeading eyebrow="Primitives" as="h2">
          Form controls
        </SectionHeading>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FormField id="name" label="Full name" required>
            <Input
              id="name"
              placeholder="Jane Wanjiru"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </FormField>

          <FormField id="name-error" label="Full name" error="This field is required">
            <Input id="name-error" invalid placeholder="Jane Wanjiru" />
          </FormField>

          <FormField id="bio" label="Short bio" hint="Max 200 characters">
            <Textarea id="bio" placeholder="Tell us about yourself..." />
          </FormField>

          <FormField id="country" label="Country">
            <CountrySelect
              id="country"
              countries={SAMPLE_COUNTRIES}
              value={country}
              onChange={setCountry}
            />
          </FormField>

          <FormField id="state" label="State / region">
            <Select
              id="state"
              options={SAMPLE_STATES}
              value={stateValue}
              onChange={setStateValue}
              placeholder="Select a region"
            />
          </FormField>

          <FormField id="phone" label="Phone number">
            <PhoneInput
              id="phone"
              countries={SAMPLE_COUNTRIES}
              countryIso2={countryIso2}
              onCountryChange={setCountryIso2}
              value={phone}
              onChange={setPhone}
            />
          </FormField>
        </div>

        <Checkbox
          id="newsletter"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          label="Send me updates about new releases"
        />
      </section>

      {/* OAuth */}
      <section className="flex flex-col gap-6">
        <SectionHeading eyebrow="Primitives" as="h2" align="center">
          OAuth buttons
        </SectionHeading>
        <OAuthButtonRow
          onGoogleClick={() => console.info("[style-guide] Google click")}
          onAppleClick={() => console.info("[style-guide] Apple click")}
          onFacebookClick={() => console.info("[style-guide] Facebook click")}
        />
      </section>
    </main>
  );
}
