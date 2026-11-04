import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type * as React from "react";
import { ThemeProvider, useTheme } from "../theme";

const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;
afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  document.documentElement.classList.remove("dark");
});

describe("theme", () => {
  it("is light by default even when the device prefers dark", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("dark"), addEventListener: () => {}, removeEventListener: () => {} }));
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("light");
    expect(result.current.resolved).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("remembers an explicit choice, including System", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.setTheme("system"));
    expect(localStorage.getItem("stockout.inspection.theme")).toBe("system");
    act(() => result.current.setTheme("dark"));
    expect(result.current.resolved).toBe("dark");
  });
});
