import { getDictionary } from "@/i18n/getDictionary";
import CheckoutClient from "./_components/CheckoutClient";

export default async function CheckoutPage({ params, searchParams }) {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : {};
  const dict = await getDictionary(locale);
  return <CheckoutClient locale={locale} dict={dict} buyNow={sp?.buyNow === "1"} />;
}
