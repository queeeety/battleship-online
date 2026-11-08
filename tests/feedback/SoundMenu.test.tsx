import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SoundMenu, SoundPanel, closesMenu, toggleChannel, volumeChange } from "../../components/feedback/SoundMenu";
import { DEFAULT_SOUND_SETTINGS } from "../../lib/audio/soundSettings";

// no DOM in these tests (no jsdom), so the menu is rendered to HTML and its logic is tested directly;
// clicking, Escape and focus return are in the manual checklist

function attr(html: string, name: string): string[]
{
    return [...html.matchAll(new RegExp(`${name}="([^"]*)"`, "g"))].map(match => match[1]);
}

describe("SoundMenu", () =>
{
    it("renders a closed speaker button that points at its panel", () =>
    {
        const html = renderToStaticMarkup(<SoundMenu />);
        expect(html).toContain('aria-label="Sound"');
        expect(attr(html, "aria-expanded")).toEqual(["false"]);
        const [controls] = attr(html, "aria-controls");
        expect(controls).toBeTruthy();
        expect(html).toContain(`id="${controls}" hidden=""`);
    });
});

describe("SoundPanel", () =>
{
    const render = (settings = DEFAULT_SOUND_SETTINGS, open = true): string =>
        renderToStaticMarkup(<SoundPanel id="p" open={open} settings={settings} onChange={() => undefined} />);

    it("shows a labelled switch and slider for effects and for music", () =>
    {
        const html = render();
        expect(html).toContain("Sound effects");
        expect(html).toContain("Music");
        expect(attr(html, "role").filter(role => role === "switch")).toHaveLength(2);
        expect(attr(html, "aria-label")).toEqual(
            expect.arrayContaining(["Sound effects volume", "Music volume"])
        );
    });

    it("shows the current settings", () =>
    {
        const html = render({ effectsMuted: false, effectsVolume: 0.8, musicMuted: true, musicVolume: 0.2 });
        expect(attr(html, "aria-checked")).toEqual(["true", "false"]);
        expect(attr(html, "value")).toEqual(["80", "20"]);
        expect(attr(html, "aria-valuetext")).toEqual(["80%", "20%"]);
        expect(html).toContain(">On<");
        expect(html).toContain(">Off<");
    });

    it("is hidden while closed and shown while open", () =>
    {
        expect(render(DEFAULT_SOUND_SETTINGS, false)).toContain('hidden=""');
        expect(render(DEFAULT_SOUND_SETTINGS, true)).not.toContain('hidden=""');
    });
});

describe("toggleChannel", () =>
{
    it("flips effects only", () =>
    {
        expect(toggleChannel(DEFAULT_SOUND_SETTINGS, "effects")).toEqual({ effectsMuted: true });
    });

    it("flips music only", () =>
    {
        expect(toggleChannel({ ...DEFAULT_SOUND_SETTINGS, musicMuted: true }, "music")).toEqual({ musicMuted: false });
    });
});

describe("volumeChange", () =>
{
    it.each([
        ["effects", 50, { effectsVolume: 0.5 }],
        ["music", 0, { musicVolume: 0 }],
        ["music", 100, { musicVolume: 1 }]
    ] as const)("%s at %s%% gives %o", (channel, percent, expected) =>
    {
        expect(volumeChange(channel, percent)).toEqual(expected);
    });
});

describe("closesMenu", () =>
{
    it("closes on Escape", () =>
    {
        expect(closesMenu("Escape")).toBe(true);
    });

    it.each(["Enter", " ", "Tab", "ArrowLeft"])("stays open on %j", (key) =>
    {
        expect(closesMenu(key)).toBe(false);
    });
});
