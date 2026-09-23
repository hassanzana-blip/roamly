import { singleFlight } from "../singleFlight";

describe("singleFlight: ett trykk om gangen", () => {
  it("et nytt kall mens det første pågår gjør ingenting; etterpå går det igjen", async () => {
    let release: () => void = () => undefined;
    const fn = jest.fn(() => new Promise<string>((resolve) => (release = () => resolve("ok"))));
    const once = singleFlight(fn);
    const first = once();
    const second = once();
    expect(fn).toHaveBeenCalledTimes(1);
    await expect(second).resolves.toBeUndefined();
    release();
    await expect(first).resolves.toBe("ok");
    const third = once();
    expect(fn).toHaveBeenCalledTimes(2);
    release();
    await third;
  });

  it("en feil slipper låsen, så neste trykk virker", async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce("ok");
    const once = singleFlight(fn);
    await expect(once()).rejects.toThrow("x");
    await expect(once()).resolves.toBe("ok");
  });
});
