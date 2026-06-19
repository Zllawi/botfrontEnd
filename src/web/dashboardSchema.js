const DASHBOARD_PAGES = [
  {
    id: "home",
    icon: "grid",
    title: "Home",
    subtitle: "Quick overview of bot performance"
  },
  {
    id: "server-settings",
    icon: "server",
    title: "Server Settings",
    subtitle: "Configure each server independently"
  },
  {
    id: "categories",
    icon: "tags",
    title: "Categories",
    subtitle: "Create and organize confession categories"
  },
  {
    id: "moderation",
    icon: "shield",
    title: "Moderation",
    subtitle: "Advanced filtering and moderation controls"
  },
  {
    id: "ai-settings",
    icon: "spark",
    title: "AI Settings",
    subtitle: "Tune AI behavior and responses"
  },
  {
    id: "logs",
    icon: "logs",
    title: "Logs & Confessions",
    subtitle: "Search, filter, and inspect full history"
  },
  {
    id: "analytics",
    icon: "chart",
    title: "Analytics",
    subtitle: "Detailed stats and usage activity"
  },
  {
    id: "branding",
    icon: "palette",
    title: "Branding & Appearance",
    subtitle: "Customize bot and dashboard appearance"
  },
  {
    id: "language",
    icon: "globe",
    title: "Language",
    subtitle: "Set bot and dashboard language"
  },
  {
    id: "welcome",
    icon: "spark",
    title: "Welcome",
    subtitle: "Configure animated welcome messages"
  },
  {
    id: "levels",
    icon: "chart",
    title: "Levels",
    subtitle: "Configure XP system and level role rewards"
  },
  {
    id: "economy",
    icon: "spark",
    title: "Economy & Shop",
    subtitle: "Configure points earning, shop items, and role purchase rules"
  },
  {
    id: "panel-editor",
    icon: "palette",
    title: "Panel Editor",
    subtitle: "Edit panel design, text, and media"
  },
  {
    id: "announcements",
    icon: "logs",
    title: "Announcements",
    subtitle: "Compose and send server announcements"
  },
  {
    id: "bot-control",
    icon: "server",
    title: "Bot Control",
    subtitle: "Control the main bot and helper bots"
  },
  {
    id: "developer-center",
    icon: "shield",
    title: "Developer Center",
    subtitle: "Global bot monitoring and advanced telemetry"
  },
  {
    id: "help",
    icon: "help",
    title: "Help",
    subtitle: "Quick guide for commands and core settings"
  }
];

const REACT_COMPONENT_BLUEPRINT = {
  layout: {
    shell: [
      "DashboardLayout",
      "SidebarNav",
      "Topbar",
      "ContentRouter",
      "ToastProvider",
      "ModalProvider"
    ],
    shared: [
      "MetricCard",
      "SectionCard",
      "ChartCard",
      "DataTable",
      "EmptyState",
      "SkeletonBlock",
      "ConfirmModal",
      "Tooltip"
    ]
  },
  pages: {
    home: [
      "OverviewMetricsGrid",
      "ActivityLineChart",
      "RecentActivityFeed",
      "BotHealthWidget",
      "TopServersWidget",
      "PendingModerationWidget"
    ],
    serverSettings: [
      "ServerSelector",
      "ChannelPickerField",
      "BooleanSwitchField",
      "NumericConfigField",
      "SaveSettingsToolbar"
    ],
    categories: [
      "CategoryListTable",
      "CategoryEditorModal",
      "ColorPickerField",
      "EmojiIconField",
      "SortHandle"
    ],
    moderation: [
      "BadWordsManager",
      "ToxicitySlider",
      "ToggleMatrix",
      "AutoRejectRulesPanel"
    ],
    aiSettings: [
      "ProviderStatusCard",
      "PromptEditor",
      "PromptTemplateEditor",
      "AiBehaviorSliders",
      "AiTogglesPanel"
    ],
    logs: [
      "LogsFiltersToolbar",
      "LogsDataTable",
      "ConfessionDetailsDrawer",
      "ActionHistoryTimeline",
      "ExportButton"
    ],
    analytics: [
      "ConfessionsTimeSeries",
      "ActiveServersBarChart",
      "CategoriesPie",
      "ModerationStackChart",
      "AiFilterStats",
      "UserHeatmap"
    ],
    branding: [
      "ThemeConfigPanel",
      "EmbedColorPicker",
      "FooterTextField",
      "CustomMessagesEditor"
    ],
    language: [
      "LanguageSelector",
      "DirectionPreview"
    ],
    welcome: [
      "WelcomeChannelPicker",
      "WelcomeMessageEditor",
      "WelcomeBackgroundSelector",
      "WelcomeMentionToggle"
    ],
    levels: [
      "LevelsToggle",
      "XpRangeEditor",
      "CooldownEditor",
      "LevelRoleRewardsEditor",
      "LevelCardTemplatePreview"
    ],
    economy: [
      "EconomyToggle",
      "EarningLimitEditor",
      "ShopChannelPicker",
      "ShopItemsEditor",
      "PurchasableRolesEditor"
    ],
    panelEditor: [
      "PanelTextEditor",
      "PanelMediaEditor",
      "PanelColorEditor",
      "PanelPreviewActions"
    ],
    announcements: [
      "AnnouncementChannelPicker",
      "AnnouncementComposer",
      "AnnouncementImagePicker",
      "AnnouncementSendAction",
      "PollComposer",
      "GiveawayComposer"
    ],
    botControl: [
      "ManagedBotSelector",
      "HelperBotRegistry",
      "BotMessageComposer",
      "BotVoiceControls"
    ],
    developerCenter: [
      "GlobalTelemetrySummary",
      "PerGuildMonitoringTable",
      "PermissionHealthBadges",
      "RealtimeSnapshotRefresh"
    ],
    help: [
      "QuickStartGuide",
      "CommonIssuesList",
      "CommandsReference",
      "SupportLinks"
    ]
  }
};

module.exports = {
  DASHBOARD_PAGES,
  REACT_COMPONENT_BLUEPRINT
};
