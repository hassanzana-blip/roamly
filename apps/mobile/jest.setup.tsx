/* eslint-disable @typescript-eslint/no-require-imports */
// Testoppsett: bare de native grensene byttes ut (nøkkelring, nettleser, UUID,
// datovelger, SVG, safe area). All appkode – klient, prisregler, skjermer – er ekte.

jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

// Nøkkelringen: et minnelager som husker hvilke valg hver verdi ble lagret med.
jest.mock("expo-secure-store", () => {
  const store = new Map<string, { value: string; options: unknown }>();
  return {
    WHEN_UNLOCKED: 0,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 5,
    AFTER_FIRST_UNLOCK: 1,
    __store: store,
    setItemAsync: jest.fn(async (key: string, value: string, options?: unknown) => {
      store.set(key, { value, options });
    }),
    getItemAsync: jest.fn(async (key: string) => store.get(key)?.value ?? null),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

// Filsystemet (innstillinger på telefonen): filer i minnet, tømt før hver test.
jest.mock("expo-file-system", () => {
  const files = new Map<string, string>();
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((p) => (typeof p === "string" ? p : p.uri)).join("/");
    }
    get exists() {
      return files.has(this.uri);
    }
    textSync() {
      const v = files.get(this.uri);
      if (v === undefined) throw new Error("ENOENT");
      return v;
    }
    write(content: string) {
      files.set(this.uri, content);
    }
    delete() {
      files.delete(this.uri);
    }
  }
  return { __files: files, File, Paths: { document: { uri: "file:///documents" }, cache: { uri: "file:///cache" } } };
});

beforeEach(() => {
  require("expo-file-system").__files.clear();
  require("./src/lib/localStore").__resetLocalStoreForTests();
});

// Leverandørens side åpnes i SFSafariViewController – her et spionobjekt.
jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn(async () => ({ type: "dismiss" })),
}));

// Bilder: en View med samme tilgjengelighetsetikett.
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  const Image = (props: { testID?: string; accessibilityLabel?: string }) => <View testID={props.testID} accessibilityLabel={props.accessibilityLabel} />;
  return { __esModule: true, Image };
});

jest.mock("expo-crypto", () => ({
  randomUUID: () => "11111111-2222-4333-8444-555555555555",
}));

jest.mock("@react-native-community/datetimepicker", () => {
  const { View } = require("react-native");
  // onChange videresendes, så tester kan velge en dato: fireEvent(picker, "onChange", {}, dato).
  const Picker = (props: { testID?: string; accessibilityLabel?: string; onChange?: (e: unknown, d?: Date) => void }) => (
    <View testID={props.testID} accessibilityLabel={props.accessibilityLabel} {...({ onChange: props.onChange } as object)} />
  );
  return { __esModule: true, default: Picker };
});

jest.mock("react-native-svg", () => {
  const { View } = require("react-native");
  const Stub = () => <View />;
  return { __esModule: true, default: Stub, Svg: Stub, Path: Stub, Circle: Stub, Rect: Stub, Defs: Stub, LinearGradient: Stub, Stop: Stub };
});

// expo-router: navigasjonen registreres, skjermene rendres direkte.
const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  router: mockRouter,
  useLocalSearchParams: () => mockParams,
}));

(globalThis as unknown as { __router: typeof mockRouter; __setParams: (p: Record<string, string>) => void }).__router = mockRouter;
(globalThis as unknown as { __setParams: (p: Record<string, string>) => void }).__setParams = (p) => {
  mockParams = p;
};

beforeEach(() => {
  mockRouter.push.mockClear();
  mockRouter.back.mockClear();
  mockRouter.replace.mockClear();
  mockParams = {};
});

// Første skjermtest i en kald kjøring (tom Babel-cache, treg disk, Windows)
// bruker flere sekunder bare på å laste React Native. Jests standard på 5 s
// feiler da testen, og den halvferdige renderingen river med seg neste test.
// Rause grenser her; en test som faktisk henger, feiler fortsatt.
jest.setTimeout(30_000);
require("@testing-library/react-native").configure({ asyncUtilTimeout: 4_000 });
