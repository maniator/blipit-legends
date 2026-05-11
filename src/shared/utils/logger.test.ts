import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appLog, createLogger } from "./logger";

describe("createLogger", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("log calls console.log with styled badge format", () => {
    const logger = createLogger("test");
    logger.log("hello");
    expect(console.log).toHaveBeenCalledWith(
      "%c test %c hello",
      expect.stringContaining("background"),
      expect.stringContaining("color:inherit"),
    );
  });

  it("warn calls console.warn with styled badge format", () => {
    const logger = createLogger("test");
    logger.warn("watch out");
    expect(console.warn).toHaveBeenCalledWith(
      "%c test %c watch out",
      expect.stringContaining("background"),
      expect.stringContaining("color:inherit"),
    );
  });

  it("error calls console.error with styled badge format", () => {
    const logger = createLogger("test");
    logger.error("broken");
    expect(console.error).toHaveBeenCalledWith(
      "%c test %c broken",
      expect.stringContaining("background"),
      expect.stringContaining("color:inherit"),
    );
  });

  it("passes extra args through to console.log", () => {
    const logger = createLogger("app");
    const extra = { detail: 42 };
    logger.log("msg", extra);
    expect(console.log).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      extra,
    );
  });
});

describe("appLog singleton", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("appLog.log calls console.log", () => {
    appLog.log("game started");
    expect(console.log).toHaveBeenCalled();
  });

  it("appLog.warn calls console.warn", () => {
    appLog.warn("low volume");
    expect(console.warn).toHaveBeenCalled();
  });

  it("appLog.error calls console.error", () => {
    appLog.error("crash");
    expect(console.error).toHaveBeenCalled();
  });
});
