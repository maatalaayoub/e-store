import { getDictionary } from "@/i18n/getDictionary";
import CheckoutClient from "./_components/CheckoutClient";

export default async function CheckoutPage({ params }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  return <CheckoutClient locale={locale} dict={dict} />;
}
