import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Moon,
  Sun,
  Key,
  CreditCard,
  Bot,
  Loader2,
  Search,
  ChevronDown,
  User,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Sparkles,
  DollarSign,
  Maximize2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { post, get, del } from "@/lib/api";

interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextLength: number;
  inputPrice: number;
  outputPrice: number;
  modality: string;
  isModerated: boolean;
}

interface ProviderGroup {
  provider: string;
  label: string;
  models: ModelInfo[];
}

interface ModelsResponse {
  providers: ProviderGroup[];
  cached?: boolean;
}

// Static fallback providers in case API fails
const FALLBACK_PROVIDERS: ProviderGroup[] = [
  {
    provider: "anthropic",
    label: "Anthropic",
    models: [
      { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", contextLength: 200000, inputPrice: 3, outputPrice: 15, modality: "text+image->text", isModerated: false },
      { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", contextLength: 200000, inputPrice: 0.8, outputPrice: 4, modality: "text->text", isModerated: false },
      { id: "anthropic/claude-3-opus", name: "Claude 3 Opus", contextLength: 200000, inputPrice: 15, outputPrice: 75, modality: "text+image->text", isModerated: false },
    ],
  },
  {
    provider: "openai",
    label: "OpenAI",
    models: [
      { id: "openai/gpt-4o", name: "GPT-4o", contextLength: 128000, inputPrice: 2.5, outputPrice: 10, modality: "text+image->text", isModerated: false },
      { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", contextLength: 128000, inputPrice: 0.15, outputPrice: 0.6, modality: "text+image->text", isModerated: false },
      { id: "openai/o3-mini", name: "o3 Mini", contextLength: 200000, inputPrice: 1.1, outputPrice: 4.4, modality: "text->text", isModerated: false },
    ],
  },
  {
    provider: "deepseek",
    label: "DeepSeek",
    models: [
      { id: "deepseek/deepseek-chat", name: "DeepSeek V3", contextLength: 64000, inputPrice: 0.14, outputPrice: 0.28, modality: "text->text", isModerated: false },
      { id: "deepseek/deepseek-reasoner", name: "DeepSeek R1", contextLength: 64000, inputPrice: 0.55, outputPrice: 2.19, modality: "text->text", isModerated: false },
    ],
  },
  {
    provider: "moonshotai",
    label: "Kimi (Moonshot)",
    models: [
      { id: "moonshotai/kimi-k2", name: "Kimi K2", contextLength: 256000, inputPrice: 0.5, outputPrice: 2, modality: "text->text", isModerated: false },
    ],
  },
  {
    provider: "minimax",
    label: "MiniMax",
    models: [
      { id: "minimax/minimax-text-01", name: "MiniMax Text 01", contextLength: 1000000, inputPrice: 0.2, outputPrice: 1.1, modality: "text->text", isModerated: false },
    ],
  },
  {
    provider: "01-ai",
    label: "01.AI (Z.ai)",
    models: [
      { id: "01-ai/yi-large", name: "Yi Large", contextLength: 32768, inputPrice: 3, outputPrice: 3, modality: "text->text", isModerated: false },
    ],
  },
];

type ThemeMode = "dark" | "light";

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, updateProfile, updatePassword, isLoading: authLoading, isAuthenticated } = useAuthStore();

  // Theme
  const [theme, setTheme] = useState<ThemeMode>(
    (document.documentElement.getAttribute("data-theme-mode") as ThemeMode) ?? "dark"
  );

  // Model selector state
  const [providers, setProviders] = useState<ProviderGroup[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState("");
  const [selectedModel, setSelectedModel] = useState(() => {
    try {
      return localStorage.getItem("horizon:default-model") || "";
    } catch {
      return "";
    }
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Profile editing
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user?.name || "");
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  // Password change
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // API keys
  interface SavedKey {
    id: string;
    provider: string;
    isDefault: boolean;
    createdAt: string;
  }
  const [savedKeys, setSavedKeys] = useState<SavedKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [newKeyProvider, setNewKeyProvider] = useState("openrouter");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [showNewKeyValue, setShowNewKeyValue] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [keySuccess, setKeySuccess] = useState("");

  // Billing
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Fetch models on mount (public route — no auth needed)
  useEffect(() => {
    let cancelled = false;
    async function loadModels() {
      try {
        setModelsLoading(true);
        setModelsError("");
        const data = await get<ModelsResponse>("/v1/models/openrouter");
        if (!cancelled) {
          setProviders(data.providers);
          // Auto-expand first 3 providers
          const toExpand = new Set(data.providers.slice(0, 3).map((p) => p.provider));
          setExpandedProviders(toExpand);
          // Set default selection if none
          const firstProvider = data.providers[0];
          if (!selectedModel && firstProvider && firstProvider.models[0]) {
            setSelectedModel(firstProvider.models[0].id);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setModelsError("Failed to load models. Using fallback list.");
          setProviders(FALLBACK_PROVIDERS);
          const toExpand = new Set(FALLBACK_PROVIDERS.slice(0, 3).map((p) => p.provider));
          setExpandedProviders(toExpand);
          const fbFirst = FALLBACK_PROVIDERS[0];
          if (!selectedModel && fbFirst && fbFirst.models[0]) {
            setSelectedModel(fbFirst.models[0].id);
          }
        }
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    }
    loadModels();
    return () => { cancelled = true; };
  }, []);

  // Fetch API keys on mount (protected — wait for auth)
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    async function loadKeys() {
      try {
        setKeysLoading(true);
        const data = await get<{ keys: SavedKey[] }>("/v1/api-keys");
        if (!cancelled) setSavedKeys(data.keys);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setKeysLoading(false);
      }
    }
    loadKeys();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  // Persist selected model to localStorage
  useEffect(() => {
    if (selectedModel) {
      localStorage.setItem("horizon:default-model", selectedModel);
    }
  }, [selectedModel]);

  // Filtered providers based on search
  const filteredProviders = useMemo(() => {
    if (!searchQuery.trim()) return providers;
    const q = searchQuery.toLowerCase();
    return providers
      .map((group) => ({
        ...group,
        models: group.models.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.id.toLowerCase().includes(q)
        ),
      }))
      .filter((group) => group.models.length > 0);
  }, [providers, searchQuery]);

  const toggleProvider = useCallback((provider: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme-mode", next);
  };

  const handleBilling = async () => {
    setIsCheckingOut(true);
    try {
      const res = await post<{ url: string }>("/v1/stripe/checkout", {});
      if (res.url) {
        window.location.href = res.url;
      }
    } catch {
      // ignore
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleSaveProfile = async () => {
    setProfileError("");
    setProfileSuccess("");
    try {
      await updateProfile({ name: editName });
      setProfileSuccess("Profile updated successfully");
      setEditingProfile(false);
      setTimeout(() => setProfileSuccess(""), 3000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile");
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    try {
      await updatePassword(currentPassword, newPassword);
      setPasswordSuccess("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setChangingPassword(false);
      setTimeout(() => setPasswordSuccess(""), 3000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to update password");
    }
  };

  const handleSaveApiKey = async () => {
    setKeyError("");
    setKeySuccess("");

    if (!newKeyValue.trim() || newKeyValue.length < 10) {
      setKeyError("Please enter a valid API key");
      return;
    }

    setSavingKey(true);
    try {
      const res = await post<{ key: SavedKey }>("/v1/api-keys", {
        provider: newKeyProvider,
        key: newKeyValue.trim(),
        isDefault: savedKeys.length === 0,
      });
      setSavedKeys((prev) => [...prev, res.key]);
      setNewKeyValue("");
      setKeySuccess("API key saved successfully");
      setTimeout(() => setKeySuccess(""), 3000);
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : "Failed to save API key");
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    try {
      await del(`/v1/api-keys/${id}`);
      setSavedKeys((prev) => prev.filter((k) => k.id !== id));
    } catch {
      // ignore
    }
  };

  const selectedModelInfo = useMemo(() => {
    for (const group of providers) {
      const model = group.models.find((m) => m.id === selectedModel);
      if (model) return { ...model, providerLabel: group.label };
    }
    return null;
  }, [providers, selectedModel]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors mb-6"
        >
          <ChevronLeft size={16} />
          Back
        </button>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="font-sora text-2xl font-semibold text-text-primary mb-8">Settings</h1>

          {/* ===== ACCOUNT / PROFILE ===== */}
          <section className="mb-8">
            <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-4">
              Account
            </h2>
            <div className="bg-bg-surface border border-border-subtle p-4 space-y-4">
              {/* Profile card */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/[0.06] flex items-center justify-center text-white text-sm font-semibold font-sora">
                  {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-primary">{user?.name}</div>
                  <div className="text-xs text-text-muted">{user?.email}</div>
                  <div className="text-xs text-text-secondary font-medium mt-0.5 capitalize">
                    {user?.tier} plan
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingProfile((v) => !v);
                    setEditName(user?.name || "");
                    setProfileError("");
                    setProfileSuccess("");
                  }}
                  className="px-3 py-1.5 bg-bg-elevated border border-border-subtle text-xs text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors"
                >
                  {editingProfile ? "Cancel" : "Edit"}
                </button>
              </div>

              {/* Edit profile form */}
              <AnimatePresence>
                {editingProfile && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border-subtle pt-4 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-text-muted mb-1.5">Display Name</label>
                        <div className="flex items-center gap-2 bg-bg-elevated border border-border-subtle px-3 py-2.5 focus-within:border-border-hover transition-colors">
                          <User size={16} className="text-text-muted" />
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Your name"
                            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
                          />
                        </div>
                      </div>

                      {profileError && (
                        <div className="flex items-center gap-1.5 text-xs text-red-400">
                          <AlertCircle size={14} />
                          {profileError}
                        </div>
                      )}
                      {profileSuccess && (
                        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                          <Check size={14} />
                          {profileSuccess}
                        </div>
                      )}

                      <button
                        onClick={handleSaveProfile}
                        disabled={authLoading || !editName.trim()}
                        className="px-4 py-2 bg-white/[0.06] text-white text-sm font-medium border border-white/[0.08] hover:bg-white/[0.1] transition-all disabled:opacity-60"
                      >
                        {authLoading ? <Loader2 size={14} className="animate-spin" /> : "Save Changes"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Password change */}
              <div className="border-t border-border-subtle pt-4">
                <button
                  onClick={() => {
                    setChangingPassword((v) => !v);
                    setPasswordError("");
                    setPasswordSuccess("");
                  }}
                  className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  <Lock size={14} />
                  {changingPassword ? "Cancel password change" : "Change password"}
                </button>

                <AnimatePresence>
                  {changingPassword && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 space-y-3">
                        <PasswordInput
                          label="Current Password"
                          value={currentPassword}
                          onChange={setCurrentPassword}
                          show={showCurrentPassword}
                          toggleShow={() => setShowCurrentPassword((s) => !s)}
                        />
                        <PasswordInput
                          label="New Password"
                          value={newPassword}
                          onChange={setNewPassword}
                          show={showNewPassword}
                          toggleShow={() => setShowNewPassword((s) => !s)}
                        />
                        <PasswordInput
                          label="Confirm New Password"
                          value={confirmPassword}
                          onChange={setConfirmPassword}
                          show={showNewPassword}
                          toggleShow={() => setShowNewPassword((s) => !s)}
                        />

                        {passwordError && (
                          <div className="flex items-center gap-1.5 text-xs text-red-400">
                            <AlertCircle size={14} />
                            {passwordError}
                          </div>
                        )}
                        {passwordSuccess && (
                          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                            <Check size={14} />
                            {passwordSuccess}
                          </div>
                        )}

                        <button
                          onClick={handleChangePassword}
                          disabled={authLoading || !currentPassword || !newPassword || !confirmPassword}
                          className="px-4 py-2 bg-white/[0.06] text-white text-sm font-medium border border-white/[0.08] hover:bg-white/[0.1] transition-all disabled:opacity-60"
                        >
                          {authLoading ? <Loader2 size={14} className="animate-spin" /> : "Update Password"}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </section>

          {/* ===== MODEL SELECTOR ===== */}
          <section className="mb-8">
            <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-4">
              Model
            </h2>
            <div className="bg-bg-surface border border-border-subtle">
              {/* Header */}
              <div className="p-4 border-b border-border-subtle">
                <div className="flex items-center gap-2 mb-3">
                  <Bot size={16} className="text-text-secondary" />
                  <span className="text-sm font-medium text-text-primary">Default Model</span>
                  {selectedModelInfo && (
                    <span className="ml-auto text-xs text-text-muted">
                      via {selectedModelInfo.providerLabel}
                    </span>
                  )}
                </div>

                {/* Search */}
                <div className="flex items-center gap-2 bg-bg-elevated border border-border-subtle px-3 py-2 focus-within:border-border-hover transition-colors">
                  <Search size={14} className="text-text-muted shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search models..."
                    className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
                      className="text-text-muted hover:text-text-secondary transition-colors text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {modelsError && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-400 mt-2">
                    <AlertCircle size={14} />
                    {modelsError}
                  </div>
                )}
              </div>

              {/* Selected model banner */}
              {selectedModelInfo && (
                <div className="px-4 py-3 border-b border-border-subtle bg-white/[0.03]">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-text-secondary" />
                    <span className="text-sm font-medium text-text-primary">{selectedModelInfo.name}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <Maximize2 size={11} />
                      {selectedModelInfo.contextLength.toLocaleString()} ctx
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign size={11} />
                      ${selectedModelInfo.inputPrice}/M in
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign size={11} />
                      ${selectedModelInfo.outputPrice}/M out
                    </span>
                  </div>
                </div>
              )}

              {/* Provider groups */}
              <div className="max-h-[420px] overflow-y-auto">
                {modelsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={20} className="animate-spin text-text-muted" />
                  </div>
                ) : filteredProviders.length === 0 ? (
                  <div className="text-center py-8 text-sm text-text-muted">
                    No models match your search.
                  </div>
                ) : (
                  filteredProviders.map((group) => (
                    <div key={group.provider} className="border-b border-border-subtle last:border-b-0">
                      <button
                        onClick={() => toggleProvider(group.provider)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-elevated/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text-primary">{group.label}</span>
                          <span className="text-xs text-text-muted">({group.models.length})</span>
                        </div>
                        <ChevronDown
                          size={14}
                          className={`text-text-muted transition-transform ${
                            expandedProviders.has(group.provider) ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      <AnimatePresence initial={false}>
                        {expandedProviders.has(group.provider) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 px-4 pb-3">
                              {group.models.map((model) => (
                                <button
                                  key={model.id}
                                  onClick={() => setSelectedModel(model.id)}
                                  className={`flex flex-col items-start px-3 py-2.5 border text-left transition-colors ${
                                    selectedModel === model.id
                                      ? "border-white/20 bg-white/[0.03]"
                                      : "border-border-subtle bg-bg-elevated hover:border-border-hover"
                                  }`}
                                >
                                  <span className="text-sm text-text-primary truncate w-full">
                                    {model.name}
                                  </span>
                                  <span className="text-xs text-text-muted mt-0.5">
                                    {model.contextLength > 0
                                      ? `${(model.contextLength / 1000).toFixed(0)}k ctx`
                                      : "Unknown ctx"}
                                    {" · "}
                                    ${model.inputPrice}/M
                                  </span>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* ===== APPEARANCE ===== */}
          <section className="mb-8">
            <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-4">
              Appearance
            </h2>
            <div className="bg-bg-surface border border-border-subtle p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {theme === "dark" ? (
                    <Moon size={16} className="text-text-muted" />
                  ) : (
                    <Sun size={16} className="text-text-muted" />
                  )}
                  <span className="text-sm text-text-primary">Theme</span>
                </div>
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-2 px-3 py-1.5 bg-bg-elevated border border-border-subtle text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  {theme === "dark" ? "Dark" : "Light"}
                </button>
              </div>
            </div>
          </section>

          {/* ===== API KEYS ===== */}
          <section className="mb-8">
            <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-4">
              API Keys
            </h2>
            <div className="bg-bg-surface border border-border-subtle p-4 space-y-4">
              {/* Saved keys list */}
              {savedKeys.length > 0 && (
                <div className="space-y-2">
                  {savedKeys.map((key) => (
                    <div
                      key={key.id}
                      className="flex items-center justify-between px-3 py-2 bg-bg-elevated border border-border-subtle"
                    >
                      <div className="flex items-center gap-2">
                        <Key size={14} className="text-text-secondary" />
                        <span className="text-sm text-text-primary capitalize">{key.provider}</span>
                        {key.isDefault && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-white/[0.06] text-text-secondary font-medium">
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteKey(key.id)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new key */}
              <div className="border-t border-border-subtle pt-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Key size={16} className="text-text-secondary" />
                  <span className="text-sm font-medium text-text-primary">Add API Key</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">Provider</label>
                  <select
                    value={newKeyProvider}
                    onChange={(e) => setNewKeyProvider(e.target.value)}
                    className="w-full bg-bg-elevated border border-border-subtle px-3 py-2.5 text-sm text-text-primary outline-none focus:border-border-hover transition-colors"
                  >
                    <option value="openrouter">OpenRouter</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="openai">OpenAI</option>
                    <option value="groq">Groq</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="z.ai">01.AI (Z.ai)</option>
                    <option value="minimax">MiniMax</option>
                    <option value="kimi">Kimi (Moonshot)</option>
                    <option value="google">Google</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">API Key</label>
                  <div className="flex items-center gap-2 bg-bg-elevated border border-border-subtle px-3 py-2.5 focus-within:border-border-hover transition-colors">
                    <input
                      type={showNewKeyValue ? "text" : "password"}
                      value={newKeyValue}
                      onChange={(e) => setNewKeyValue(e.target.value)}
                      placeholder={
                        newKeyProvider === "openrouter"
                          ? "sk-or-v1-..."
                          : newKeyProvider === "anthropic"
                          ? "sk-ant-..."
                          : newKeyProvider === "openai"
                          ? "sk-..."
                          : "Your API key"
                      }
                      className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewKeyValue((s) => !s)}
                      className="p-0.5 text-text-muted hover:text-text-secondary transition-colors"
                    >
                      {showNewKeyValue ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {keyError && (
                  <div className="flex items-center gap-1.5 text-xs text-red-400">
                    <AlertCircle size={14} />
                    {keyError}
                  </div>
                )}
                {keySuccess && (
                  <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <Check size={14} />
                    {keySuccess}
                  </div>
                )}

                <button
                  onClick={handleSaveApiKey}
                  disabled={savingKey || !newKeyValue.trim()}
                  className="px-4 py-2 bg-white/[0.06] text-white text-sm font-medium border border-white/[0.08] hover:bg-white/[0.1] transition-all disabled:opacity-60"
                >
                  {savingKey ? <Loader2 size={14} className="animate-spin" /> : "Save Key"}
                </button>
              </div>

              <p className="text-xs text-text-muted">
                Your API keys are encrypted at rest with AES-256-GCM. They are never logged or shared.
              </p>
            </div>
          </section>

          {/* ===== BILLING ===== */}
          <section className="mb-8">
            <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-4">
              Billing
            </h2>
            <div className="bg-bg-surface border border-border-subtle p-4">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard size={16} className="text-text-secondary" />
                <span className="text-sm font-medium text-text-primary">Subscription</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-text-primary capitalize">{user?.tier || "Free"} Plan</div>
                  <div className="text-xs text-text-muted">
                    {user?.tier === "pro" || user?.tier === "enterprise"
                      ? "Unlimited messages"
                      : "50 messages per day"}
                  </div>
                </div>
                {user?.tier === "free" && (
                  <button
                    onClick={handleBilling}
                    disabled={isCheckingOut}
                    className="px-4 py-2 bg-white/[0.06] text-white text-sm font-medium border border-white/[0.08] hover:bg-white/[0.1] transition-all disabled:opacity-60"
                  >
                    {isCheckingOut ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      "Upgrade"
                    )}
                  </button>
                )}
              </div>
            </div>
          </section>
        </motion.div>
      </div>
    </div>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  show,
  toggleShow,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  toggleShow: () => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-muted mb-1.5">{label}</label>
      <div className="flex items-center gap-2 bg-bg-elevated border border-border-subtle px-3 py-2.5 focus-within:border-border-hover transition-colors">
        <Lock size={16} className="text-text-muted" />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
        />
        <button
          type="button"
          onClick={toggleShow}
          className="p-0.5 text-text-muted hover:text-text-secondary transition-colors"
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}
