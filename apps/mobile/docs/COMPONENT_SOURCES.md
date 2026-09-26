# HelloSky component decisions

Reviewed 23 September 2026. The native Expo app remains the implementation; the three candidates below were a small pattern review, not a template installation.

| Pattern | Source and license evidence | Runtime and accessibility review | Decision |
|---|---|---|---|
| Selector chips | [21st.dev / Preet Suthar](https://21st.dev/@preetsuthar17/components/selector-chips), linked [HextaUI source](https://hextaui.com/docs/application/selector-chips). MIT shown by the source page. | React DOM/Tailwind with Motion; not directly compatible with React Native. Selection state, readable contrast and actual 44-point native targets must be verified independently. | Use the interaction principle with HelloSky's existing native Chip and ChoiceChips. No source copied, no dependency added. |
| Stable loading placeholders | [21st.dev / shugar](https://21st.dev/@shugar/components/skeleton), linked [Vercel Geist documentation](https://vercel.com/geist/skeleton). A component redistribution license was not established from the inspected pages. | Web dependencies include clsx, csstype and tailwind-merge. Documentation supports stable content dimensions, non-focusable decoration and reduced motion. | Keep as a pattern reference for future native loading refinement. No code copied or installed. Existing loading behavior remains authoritative. |
| Bottom navigation | [21st.dev / Arunachalam](https://21st.dev/@arunachalam/components/bottom-nav-bar). No explicit license verified on the inspected listing. | Next.js/Tailwind with lucide-react and Framer Motion; animated active-only labels. The listing's accessibility claim was not independently tested. | Reject import: web runtime, excess animation and disappearing labels do not fit this app. Keep HelloSky's native navigation with persistent labels and restrained blue selection. |

The existing stack includes React Native 0.86.3, Expo 57, Expo Router, safe-area-context, expo-image, SecureStore, react-native-svg and Reanimated. No overlapping sheet, icon, animation or form library was installed for this review. Actual versions are recorded in apps/mobile/package.json and its lockfile.

Editable Figma components are original HelloSky components bound to the repository's color/spacing tokens. Six families and 17 states exist: primary button, chip, segmented trip control, input, grouped flight card and bottom navigation. The three core screen frames and picker frames are still in progress.

Photography is reused from the existing HelloSky registry and bundled for predictable loading. Some existing entries do not yet include photographer names or original source links. That provenance gap remains open; no attribution was invented and no new Unsplash API integration was claimed.
