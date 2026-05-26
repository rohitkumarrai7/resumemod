import type { TemplateVariant } from "./index";
import { TEMPLATE_STYLES, slugToVariant, variantToSlug } from "./index";

export { TEMPLATE_STYLES, slugToVariant, variantToSlug, type TemplateVariant };

export function ClassicATSStyles() {
  return TEMPLATE_STYLES.classic;
}

export function CompactATSStyles() {
  return TEMPLATE_STYLES.compact;
}

export function ModernATSStyles() {
  return TEMPLATE_STYLES.modern;
}

export function getTemplateStyles(variant: TemplateVariant) {
  return TEMPLATE_STYLES[variant];
}
