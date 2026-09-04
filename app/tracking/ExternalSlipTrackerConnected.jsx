"use client";

import { useLanguage } from "../components/LanguageProvider";
import ExternalSlipTracker from "./ExternalSlipTracker";

export default function ExternalSlipTrackerConnected() {
  const { tr, locale } = useLanguage();
  return <ExternalSlipTracker tr={tr} locale={locale} />;
}
