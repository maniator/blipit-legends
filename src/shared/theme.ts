export const theme = {
  colors: {
    // Backgrounds
    bgVoid: "#000000",
    bgSurface: "#0F1E34",
    bgInput: "#1C2E4A",
    bgInputSm: "#1a2440",
    bgGame: "#0a1628",
    bgDeep: "#0a0a1a",
    bgGameDeep: "#071020",
    bgSurfaceAlt: "#1a1a2e",
    bgPlayerDetail: "#0d1117",
    bgImport: "#0a1525",
    bgDropdown: "#111111",
    bgPaginationHover: "#25254a",
    bgSuccess: "#1a1400",

    // Borders
    borderPanel: "#2a3a5a",
    borderCard: "#2a3f60",
    borderForm: "#4a6090",
    borderSubtle: "#2a2a3a",
    borderDark: "#1e3050",
    borderAccent: "#994200",
    borderDanger: "#883333",
    borderLog: "#333333",
    borderDarkest: "#222222",
    borderMid: "#444444",
    borderGameError: "#884e4e",
    borderGameSection: "#2a2a2a",
    borderLineScore: "#1e3a5f",
    borderLineScoreCell: "#0f2540",
    borderLineScoreOff: "#2e4a6f",
    borderTableRow: "#1a1a2a",
    borderWarn: "#886600",
    borderSavesDanger: "#7a3030",
    borderWhiteAlpha: "rgba(255, 255, 255, 0.4)",
    borderFormAlpha35: "rgba(74, 96, 144, 0.35)",
    borderFormAlpha40: "rgba(74, 96, 144, 0.4)",
    borderFormAlpha30: "rgba(74, 96, 144, 0.3)",

    // Text
    textPrimary: "#ffffff",
    textBody: "#cce0ff",
    textBodyAlt: "#cce8ff",
    textDialog: "#e0f0ff",
    textMuted: "#BFC7CF",
    textSemiLight: "#bbbbbb",
    textLight: "#cccccc",
    textDisabled: "#555555",
    textDimmer: "#6B7785",
    textDropdown: "#dddddd",
    textHint: "#6e88b1",
    textLink: "#aaccff",
    textSecondaryLink: "#88bbee",
    textScore: "#e8d5a3",
    textScoreHeader: "#8abadf",
    textScoreDim: "#8fa6bf",
    textNav: "#6ab0e0",
    textNavDim: "#4a8abe",
    textNavFaint: "#5f7694",
    textFaint: "#a0b4d0",
    textModalLink: "#7a9abf",
    textReadOnly: "#8899bb",
    textNavMid: "#5577aa",
    textAccent: "#FF9A1F",
    textTeamInfo: "#C99A2E",

    // Accent — anchored to the newest logo palette (orange #FF9A1F and gold #F2C14E)
    accentPrimary: "#FF9A1F",
    accentBright: "#F2C14E",
    /** High-contrast dark text on gold/amber accent buttons */
    btnPrimaryText: "#0b1a38",

    // Status / interactive
    btnPrimaryBg: "#2a1200",
    btnPrimaryBgHover: "#461e00",
    btnPrimaryBgActive: "#180a00",
    textDanger: "#ff7070",
    bgDanger: "#b30000",
    bgNavActive: "#0f4880",
    bgWarn: "#7A3300",
    btnActionBg: "#FF6A00",
    btnActionBgHover: "#CC5500",
    statusSuccess: "#4ade80",
    statusWarn: "#FF9A1F",

    // BSO indicators — strike uses SVG gold, ball uses teal, out stays red
    bsoBall: "#44cc88",
    bsoStrike: "#F2C14E",
    bsoOut: "#ff7070",

    // Countdown bar states
    countdownWarn: "#FF9A1F",
    countdownDanger: "#ff4444",

    // Diamond / field indicators
    baseOccupied: "#3f4f7e",
    baseAway: "#ff21b1",
    fieldGrass: "#6CBF4A",
    fieldDirt: "#B06A2E",

    // Danger actions
    dangerText: "#ff7777",
    dangerHoverBg: "#2a0000",
    dangerHoverBorder: "#cc4444",

    // Error / Warning
    errorBg: "#1a0000",
    errorBgTransparent: "rgba(80, 0, 0, 0.3)",
    textError: "#ff8080",
    bgSavesDangerHover: "rgba(120, 48, 48, 0.4)",
    bgFormAlpha40: "rgba(74, 96, 144, 0.4)",
    textWarn: "#ff8888",
    textWarnStrong: "#ff9977",
    textWarnSubtle: "#FF9A1F",
    textWarnBold: "#F2C14E",
    bgWarnSurface: "#1a1a00",

    // Fatigue level indicators
    textFatigueHigh: "#ff6b6b",
    textFatigueMed: "#F2C14E",

    // Decision panel
    bgDecisionOverlay: "rgba(0, 30, 60, 0.92)",
    bgDecisionSection: "#1a2030",
    bgDecisionButton: "#3a4a6a",
    textDecisionActive: "#fef9e7",
    textDecisionHighlight: "#F2C14E",

    // Overlays
    overlayDark: "rgba(0, 0, 0, 0.75)",
    overlayMedDark: "rgba(0, 0, 0, 0.65)",
    overlayLight: "rgba(0, 0, 0, 0.6)",
    shadowDark: "rgba(0, 0, 0, 0.9)",

    // Navigation / help button
    helpButtonBg: "rgba(47, 63, 105, 0.7)",
    helpButtonBgHover: "rgba(74, 96, 144, 0.9)",
    navGroupBg: "rgba(47, 63, 105, 0.5)",
    bgNavSection: "rgba(47, 63, 105, 0.35)",
    bgFormAlpha15: "rgba(74, 96, 144, 0.15)",
    bgFormAlpha60: "rgba(74, 96, 144, 0.6)",

    // Player selection highlights
    bgPlayerSelected: "rgba(106, 176, 224, 0.12)",
    bgPlayerHover: "rgba(106, 176, 224, 0.18)",
    bgSubtle: "rgba(255, 255, 255, 0.04)",

    // Exhibition error
    bgExhibitionError: "rgba(220, 40, 40, 0.15)",
    borderExhibitionError: "rgba(220, 40, 40, 0.4)",

    // Subdued text (between textMuted and textDimmer)
    textSubdued: "#8895A2",

    // Chip / pill status backing colors
    chipSuccessBg: "rgba(74, 222, 128, 0.15)",
    chipSuccessBorder: "rgba(74, 222, 128, 0.3)",
    chipWarnBg: "rgba(242, 193, 78, 0.15)",
    chipWarnBorder: "rgba(242, 193, 78, 0.3)",
    chipDangerBg: "rgba(255, 107, 107, 0.15)",
    chipDangerBorder: "rgba(255, 107, 107, 0.3)",
    chipAccentBg: "rgba(255, 154, 31, 0.15)",
    chipAccentBorder: "rgba(255, 154, 31, 0.3)",
    chipNeutralBg: "rgba(160, 180, 208, 0.15)",
    chipNeutralBorder: "rgba(160, 180, 208, 0.3)",
  },
  fonts: {
    sans: '"Inter Variable", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace',
    score: '"Courier New", Courier, monospace',
  },
  fontSizes: {
    // px-based — UI chrome (labels, badges, buttons)
    xs: "10px",
    sm: "11px",
    label: "12px",
    base: "13px",
    md: "14px",
    lg: "15px",
    display: "16px",
    xl: "17px",
    dialogTitle: "18px",
    f20: "20px",
    // rem-based — body text (scales with root font size)
    tiny: "0.7rem",
    sub: "0.85rem",
    subLg: "0.9rem",
    body: "0.95rem",
    bodyLg: "1rem",
    bodyXl: "1.05rem",
    // rem-based — headings
    h3: "1.2rem",
    xxl: "1.3rem",
    h2: "1.4rem",
    heading: "1.5rem",
    h1: "1.6rem",
    displaySm: "1.8rem",
    displayMd: "2.5rem",
    title: "2.2rem",
    logo: "3rem",
  },
  radii: {
    xxs: "2px",
    s3: "3px",
    sm: "4px",
    md: "6px",
    lg: "8px",
    xl: "12px",
    card: "10px",
    dialog: "14px",
    pill: "20px",
    full: "9999px",
  },
  spacing: {
    xxs: "2px",
    s3: "3px",
    xs: "4px",
    s5: "5px",
    s6: "6px",
    s7: "7px",
    sm: "8px",
    s10: "10px",
    md: "12px",
    s14: "14px",
    lg: "16px",
    s18: "18px",
    xl: "20px",
    s22: "22px",
    xxl: "24px",
    s28: "28px",
    xxxl: "32px",
    s40: "40px",
    s48: "48px",
  },
  letterSpacing: {
    tight: "0.04em",
    normal: "0.5px",
    wide: "0.6px",
    wider: "0.8px",
    widest: "1px",
  },
  sizes: {
    // minimum heights / fixed dimensions for interactive elements
    inputSm: "30px",
    inputMd: "32px",
    inputLg: "36px",
    btnMd: "36px",
    btnLg: "44px",
    btnXl: "48px",
    btnXxl: "52px",
    icon: "25px",
    iconSm: "14px",
    progressBar: "4px",
    countdownLabel: "52px",
    /** Bottom-safe-area offset used in page/home containers to clear the nav bar. */
    bottomBar: "80px",
    /** Minimum height for the import/export paste textarea. */
    pasteTextarea: "80px",
    /** Home-screen logo image — desktop, standard mobile, and compact mobile sizes. */
    logoMd: "200px",
    logoSm: "160px",
    /** Compact mobile logo (home screen, small viewports). */
    logoXs: "110px",
  },
} as const;

export type AppTheme = typeof theme;
