import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NO_SELECTION_ID, type InboxFilter } from "../../../entities/inbox/model";

import { getNextSelectionId, useInboxSelection } from "./useInboxSelection";

const { openUrlMock } = vi.hoisted(() => ({
  openUrlMock: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: openUrlMock,
}));

describe("useInboxSelection", () => {
  beforeEach(() => {
    openUrlMock.mockReset();
  });

  it("moves selection with arrows and opens active item with Enter", () => {
    const { result } = renderHook(() =>
      useInboxSelection({
        filter: "notifications",
        currentItemIds: ["a", "b"],
      }),
    );

    act(() => {
      result.current.setFilterSelectionContext("notifications", ["a", "b"], (activeItemId) =>
        activeItemId === "a" ? "https://example.com/a" : null,
      );
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });

    expect(result.current.selectedItemId).toBe("a");

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    });

    expect(openUrlMock).toHaveBeenCalledWith("https://example.com/a");
  });

  it("does not open an item when Enter is pressed on a focused button", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);

    const { result } = renderHook(() =>
      useInboxSelection({
        filter: "notifications",
        currentItemIds: ["a", "b"],
      }),
    );

    act(() => {
      result.current.setFilterSelectionContext("notifications", ["a", "b"], (activeItemId) =>
        activeItemId === "a" ? "https://example.com/a" : null,
      );
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });

    act(() => {
      button.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(openUrlMock).not.toHaveBeenCalled();

    button.remove();
  });

  it("selects the first item when switching to another tab with no prior selection", () => {
    type HookProps = {
      filter: InboxFilter;
      currentItemIds: string[];
    };

    const { result, rerender } = renderHook(
      ({ filter, currentItemIds }: HookProps) =>
        useInboxSelection({
          filter,
          currentItemIds,
        }),
      {
        initialProps: {
          filter: "notifications" as InboxFilter,
          currentItemIds: ["a", "b"],
        },
      },
    );

    expect(result.current.selectedItemId).toBe(NO_SELECTION_ID);

    act(() => {
      rerender({
        filter: "mrs",
        currentItemIds: ["c", "d"],
      });
    });

    expect(result.current.selectedItemId).toBe("c");
  });

  it("suppresses hover on keyboard navigation and restores hover after mouse move", () => {
    const wrapper = document.createElement("div");
    const item = document.createElement("div");
    item.dataset.itemId = "b";
    const child = document.createElement("span");
    item.appendChild(child);
    wrapper.appendChild(item);
    document.body.appendChild(wrapper);

    const { result } = renderHook(() =>
      useInboxSelection({
        filter: "notifications",
        currentItemIds: ["a", "b"],
      }),
    );

    act(() => {
      result.current.onListMouseMove({ target: child } as never);
    });

    expect(result.current.hoveredItemId).toBe("b");

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });

    expect(result.current.hoveredItemId).toBe(NO_SELECTION_ID);

    act(() => {
      result.current.onListMouseMove({ target: child } as never);
    });

    expect(result.current.hoveredItemId).toBe("b");

    wrapper.remove();
  });
});

describe("getNextSelectionId", () => {
  it("respects list boundaries", () => {
    expect(
      getNextSelectionId({
        key: "ArrowUp",
        activeItemId: "a",
        currentItemIds: ["a", "b"],
      }),
    ).toBe("a");

    expect(
      getNextSelectionId({
        key: "ArrowDown",
        activeItemId: "b",
        currentItemIds: ["a", "b"],
      }),
    ).toBe("b");
  });
});
