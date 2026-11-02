import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { NativeSelect } from "../input";

describe("NativeSelect (styled dropdown)", () => {
  it("works controlled: shows the label and reports changes through onChange(e.target.value)", async () => {
    const onChange = vi.fn();
    function Controlled() {
      const [v, setV] = React.useState("");
      return (
        <NativeSelect aria-label="Sort" value={v} onChange={(e) => { onChange(e.target.value); setV(e.target.value); }}>
          <option value="">All</option>
          <option value="price_asc">Price: low to high</option>
        </NativeSelect>
      );
    }
    render(<Controlled />);
    const trigger = screen.getByRole("combobox", { name: "Sort" });
    expect(trigger).toHaveTextContent("All");
    await userEvent.click(trigger);
    await userEvent.click(await screen.findByRole("option", { name: "Price: low to high" }));
    expect(onChange).toHaveBeenCalledWith("price_asc");
    expect(trigger).toHaveTextContent("Price: low to high");
  });

  it("works with react-hook-form register, reset and submit", async () => {
    const submitted = vi.fn();
    function Form() {
      const form = useForm({ defaultValues: { unit: "kg" } });
      return (
        <form onSubmit={form.handleSubmit(submitted)}>
          <label htmlFor="unit">Unit</label>
          <NativeSelect id="unit" {...form.register("unit")}>
            <option value="pcs">Piece</option>
            <option value="kg">Kilogram</option>
            <option value="m">Metre</option>
          </NativeSelect>
          <button type="button" onClick={() => form.reset({ unit: "m" })}>Reset</button>
          <button type="submit">Save</button>
        </form>
      );
    }
    render(<Form />);
    const trigger = screen.getByRole("combobox", { name: "Unit" });
    expect(trigger).toHaveTextContent("Kilogram");
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(trigger).toHaveTextContent("Metre");
    await userEvent.click(trigger);
    await userEvent.click(await screen.findByRole("option", { name: "Piece" }));
    expect(trigger).toHaveTextContent("Piece");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(submitted).toHaveBeenCalledWith({ unit: "pcs" }, expect.anything());
  });

  it("adds a search box to long lists (sellers, categories…) and filters as you type", async () => {
    const onChange = vi.fn();
    const sellers = Array.from({ length: 30 }, (_, i) => `Seller ${String(i + 1).padStart(2, "0")}`).concat("Sharaco Trading");
    function Long() {
      const [v, setV] = React.useState("");
      return (
        <NativeSelect aria-label="Seller" value={v} onChange={(e) => { onChange(e.target.value); setV(e.target.value); }}>
          <option value="">All sellers</option>
          {sellers.map((s) => (
            <option key={s} value={s.toLowerCase().replace(/ /g, "-")}>
              {s}
            </option>
          ))}
        </NativeSelect>
      );
    }
    render(<Long />);
    const trigger = screen.getByRole("combobox", { name: "Seller" });
    await userEvent.click(trigger);
    const search = await screen.findByRole("textbox", { name: "Search options" });
    expect(search).toHaveFocus();
    await userEvent.type(search, "shara");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("sharaco-trading");
    expect(trigger).toHaveTextContent("Sharaco Trading");

    await userEvent.click(trigger);
    await userEvent.type(await screen.findByRole("textbox", { name: "Search options" }), "zzz");
    expect(screen.getByText(/No matches/)).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(trigger);
    await userEvent.click(await screen.findByRole("option", { name: "All sellers" }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});
