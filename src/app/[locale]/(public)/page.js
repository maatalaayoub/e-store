import { getSeoSettings } from "@/lib/seo/settings";
import { buildStoreMetadata } from "@/lib/seo/metadata";
import {
  buildOrganizationJsonLd,
  buildWebsiteJsonLd,
  jsonLdScript,
} from "@/lib/seo/jsonld";
import HomeClient from "./_components/HomeClient";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const store = await getSeoSettings();
  return buildStoreMetadata({ locale, store, siteUrl: store.siteUrl });
}

export default async function HomePage() {
  const store = await getSeoSettings();
  const orgJsonLd = buildOrganizationJsonLd({ store, siteUrl: store.siteUrl });
  const websiteJsonLd = buildWebsiteJsonLd({ store, siteUrl: store.siteUrl });

  return (
    <>
      {orgJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(orgJsonLd) }}
        />
      )}
      {websiteJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(websiteJsonLd) }}
        />
      )}
      <HomeClient />
    </>
  );
}

