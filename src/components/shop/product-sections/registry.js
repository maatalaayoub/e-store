/**
 * Component registry — maps a section type to its React component.
 *
 * To register a new section type:
 *   1. Add an entry in `src/modules/product-sections/registry.js`.
 *   2. Build a renderer in `./section-components.js`.
 *   3. Add the `type → component` mapping below.
 */

import { SECTION_TYPES } from '@/modules/product-sections/registry';
import {
  DescriptionSection,
  GallerySection,
  ShippingSection,
  ReviewsSection,
  RatingsSection,
  SpecificationsSection,
  FAQSection,
  RichTextSection,
  ImageTextSection,
  VideoSection,
  BannerSection,
  RelatedProductsSection,
  IngredientsSection,
  CustomSection,
} from './section-components';
import InlineCheckoutSection from './InlineCheckoutSection';

export const SECTION_COMPONENTS = {
  [SECTION_TYPES.DESCRIPTION]: DescriptionSection,
  [SECTION_TYPES.GALLERY]: GallerySection,
  [SECTION_TYPES.SHIPPING]: ShippingSection,
  [SECTION_TYPES.REVIEWS]: ReviewsSection,
  [SECTION_TYPES.RATINGS]: RatingsSection,
  [SECTION_TYPES.SPECIFICATIONS]: SpecificationsSection,
  [SECTION_TYPES.FAQ]: FAQSection,
  [SECTION_TYPES.RICH_TEXT]: RichTextSection,
  [SECTION_TYPES.IMAGE_TEXT]: ImageTextSection,
  [SECTION_TYPES.VIDEO]: VideoSection,
  [SECTION_TYPES.BANNER]: BannerSection,
  [SECTION_TYPES.RELATED_PRODUCTS]: RelatedProductsSection,
  [SECTION_TYPES.CHECKOUT]: InlineCheckoutSection,
  [SECTION_TYPES.INGREDIENTS]: IngredientsSection,
  [SECTION_TYPES.CUSTOM]: CustomSection,
};

export function getSectionComponent(type) {
  return SECTION_COMPONENTS[type] ?? null;
}
