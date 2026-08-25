import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import Layout from "../components/Layout";
import {
  getAllSettings,
  saveSetting,
  getAllRecords,
  getRecordsByStatus,
  deleteRecord,
  updateRecord,
} from "../lib/db";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { syncPendingRecords } from "../lib/sync";
import { useAuth, AuthSpinner } from "../lib/useAuth";
import { filterRecordsForUser } from "../lib/auth";

function SettingsSection({ title, children }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-gray-800">{title}</h2>
      {children}
    </div>
  );
}

function SettingsInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoFormat,
}) {
  const handleBlur = () => {
    if (autoFormat === "titleCase" && value) {
      onChange(titleCaseValue(value));
    }
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="form-input text-base"
      />
    </div>
  );
}

export default function SettingsPage() {
  const { user, isLoading: authLoading, logout } = useAuth(true);
  const { isOnline } = useOnlineStatus();
  const [agentName, setAgentName] = useState("");
  const [agentEmployeeId, setAgentEmployeeId] = useState("");
  const [agentMobile, setAgentMobile] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [connectionDetails, setConnectionDetails] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isClearingSynced, setIsClearingSynced] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    synced: 0,
    failed: 0,
    draft: 0,
  });

  const showToast = useCallback((message, type = "info") => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const loadStats = useCallback(async () => {
    if (!user) return;
    const allRaw = await getAllRecords();
    const all = filterRecordsForUser(allRaw, user, user.role === "admin");
    setStats({
      total: all.length,
      pending: all.filter((record) => record.syncStatus === "pending").length,
      synced: all.filter((record) => record.syncStatus === "synced").length,
      failed: all.filter((record) => record.syncStatus === "failed").length,
      draft: all.filter((record) => record.syncStatus === "draft").length,
    });
  }, [user]);

  useEffect(() => {
    async function loadSettings() {
      const settings = await getAllSettings();
      setAgentName(settings.agentName || user?.name || "");
      setAgentEmployeeId(settings.agentEmployeeId || user?.id || "");
      setAgentMobile(settings.agentMobile || "");
      setAgentEmail(settings.agentEmail || user?.email || "");
      await loadStats();
    }

    if (user) loadSettings();
  }, [loadStats, user]);

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    await saveSetting("agentName", agentName.trim());
    await saveSetting("agentEmployeeId", agentEmployeeId.trim());
    await saveSetting("agentMobile", agentMobile.trim());
    await saveSetting("agentEmail", agentEmail.trim());
    setIsSavingProfile(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
    showToast("Profile saved", "success");
  };

  const handleTestConnection = async () => {
    setConnectionStatus("testing");
    try {
      const response = await fetch("/api/testconnection");
      const data = await response.json();

      if (data.connected) {
        setConnectionStatus("connected");
        setConnectionDetails(
          `Sheet: "${data.sheetTitle}" | Tab: ${data.tabName}`,
        );
      } else {
        setConnectionStatus("failed");
        setConnectionDetails(data.error || "Unknown error");
      }
    } catch (error) {
      setConnectionStatus("failed");
      setConnectionDetails(error.message);
    }
  };

  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      const recordsRaw = await getAllRecords();
      const records = filterRecordsForUser(
        recordsRaw,
        user,
        user.role === "admin",
      );
      const json = JSON.stringify(records, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
      anchor.href = url;
      anchor.download = `heipl_e2p_records_${today}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      showToast(`Exported ${records.length} records`, "success");
    } catch (error) {
      showToast(`Export failed: ${error.message}`, "error");
    }
    setIsExporting(false);
  };

  const handleClearSynced = async () => {
    setIsClearingSynced(true);
    try {
      const syncedRaw = await getRecordsByStatus("synced");
      const synced = filterRecordsForUser(
        syncedRaw,
        user,
        user.role === "admin",
      );
      for (const record of synced) {
        await deleteRecord(record.id);
      }
      showToast(`Cleared ${synced.length} synced records`, "success");
      await loadStats();
    } catch (error) {
      showToast(`Clear failed: ${error.message}`, "error");
    }
    setIsClearingSynced(false);
  };

  const handleForceSyncAll = async () => {
    const failedRaw = await getRecordsByStatus("failed");
    const failed = filterRecordsForUser(failedRaw, user, user.role === "admin");
    for (const record of failed) {
      await updateRecord(record.id, { syncStatus: "pending", syncError: null });
    }
    await syncPendingRecords();
    showToast("Force sync started", "info");
    await loadStats();
  };

  if (authLoading) return <AuthSpinner />;
  if (!user) return null;

  return (
    <>
      <Head>
        <title>Settings | HEIPL-E2P</title>
      </Head>

      <Layout title="Settings">
        <div className="space-y-4 px-4 py-4 pb-8">
          {/* <SettingsSection title="👤 Agent Profile">
            <div className="space-y-3">
              <SettingsInput
                label="Full Name"
                value={agentName}
                onChange={setAgentName}
                placeholder="Your full name"
                autoFormat="titleCase"
              />
              <SettingsInput
                label="Employee ID"
                value={agentEmployeeId}
                onChange={setAgentEmployeeId}
                placeholder="Employee ID"
              />
              <SettingsInput
                label="Mobile Number"
                value={agentMobile}
                onChange={setAgentMobile}
                placeholder="03XXXXXXXXX"
                type="tel"
              />
              <SettingsInput
                label="Email"
                value={agentEmail}
                onChange={setAgentEmail}
                placeholder="your@email.com"
                type="email"
              />

              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="btn-primary flex w-full items-center justify-center gap-2 py-3"
              >
                {isSavingProfile
                  ? "Saving..."
                  : profileSaved
                    ? "✅ Saved!"
                    : "💾 Save Profile"}
              </button>

              <p className="text-center text-xs text-gray-500">
                These details auto-fill into every new form
              </p>
            </div>
          </SettingsSection> */}

          <SettingsSection title="☁️ Google Sheets Sync">
            <div className="mb-3">
              {connectionStatus === null && (
                <p className="text-sm text-gray-500">Not tested yet</p>
              )}
              {connectionStatus === "testing" && (
                <p className="flex items-center gap-2 text-sm text-blue-600">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  Testing connection...
                </p>
              )}
              {connectionStatus === "connected" && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <p className="text-sm font-medium text-green-700">
                    ✅ Connected
                  </p>
                  <p className="mt-0.5 text-xs text-green-600">
                    {connectionDetails}
                  </p>
                </div>
              )}
              {connectionStatus === "failed" && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm font-medium text-red-700">
                    ❌ Connection Failed
                  </p>
                  <p className="mt-0.5 break-words text-xs text-red-600">
                    {connectionDetails}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={connectionStatus === "testing"}
                className="btn-secondary py-3 text-sm"
              >
                🔌 Test Connection
              </button>

              <button
                type="button"
                onClick={handleForceSyncAll}
                disabled={
                  !isOnline || (stats.pending === 0 && stats.failed === 0)
                }
                className="btn-primary py-3 text-sm disabled:opacity-50"
              >
                ☁️ Force Sync All
              </button>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              {[
                { label: "Total", value: stats.total, color: "text-gray-700" },
                {
                  label: "Pending",
                  value: stats.pending,
                  color: "text-amber-600",
                },
                {
                  label: "Synced",
                  value: stats.synced,
                  color: "text-green-600",
                },
                { label: "Failed", value: stats.failed, color: "text-red-600" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-gray-50 p-2">
                  <div className={`text-lg font-bold ${item.color}`}>
                    {item.value}
                  </div>
                  <div className="text-[10px] text-gray-500">{item.label}</div>
                </div>
              ))}
            </div>
          </SettingsSection>

          <SettingsSection title="🗄️ Data Management">
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleExportJSON}
                disabled={isExporting}
                className="btn-secondary flex w-full items-center justify-center gap-2 py-3 text-sm"
              >
                {isExporting ? "Exporting..." : "📥 Export All Records as JSON"}
              </button>
              <p className="text-xs text-gray-500">
                Downloads a backup of all records to your device
              </p>

              <div className="mt-2 border-t border-gray-100 pt-2" />

              <button
                type="button"
                onClick={handleClearSynced}
                disabled={isClearingSynced || stats.synced === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 py-3 text-sm text-amber-700 disabled:opacity-50"
              >
                {isClearingSynced
                  ? "Clearing..."
                  : `🧹 Clear Synced Records (${stats.synced})`}
              </button>
              <p className="text-xs text-gray-500">
                Removes synced records from this device to free up space. Data
                remains in Google Sheets.
              </p>
            </div>
          </SettingsSection>

          <SettingsSection title="ℹ️ App Info">
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Version</span>
                <span className="font-mono text-gray-800">
                  {process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>App</span>
                <span className="text-gray-800">
                  HEIPL-E2P Energy Efficient Program
                </span>
              </div>
              <div className="flex justify-between">
                <span>Organization</span>
                <span className="text-gray-800">
                  HEIPL - Energy Efficient Program
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Contact admin to change password
              </p>
              <div className="mt-2 border-t border-gray-100 pt-2 text-center text-xs text-gray-400">
                All data is stored locally on this device and synced to Google
                Sheets when internet is available.
              </div>
            </div>
          </SettingsSection>

          <button
            type="button"
            onClick={logout}
            className="w-full rounded-xl border-2 border-red-300 py-3 font-medium text-red-600 active:bg-red-50"
          >
            🚪 Sign Out
          </button>
        </div>

        {toastMessage && (
          <div
            className={`fixed bottom-24 left-4 right-4 z-50 rounded-xl px-4 py-3 text-center text-sm font-medium text-white shadow-lg ${
              toastMessage.type === "success"
                ? "bg-green-600"
                : toastMessage.type === "error"
                  ? "bg-red-600"
                  : "bg-gray-800"
            }`}
          >
            {toastMessage.message}
          </div>
        )}
      </Layout>
    </>
  );
}
