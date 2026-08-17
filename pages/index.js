import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import SyncStatus from '../components/SyncStatus';
import { getAllRecords, getSetting } from '../lib/db';
import { timeAgo } from '../lib/utils';

function StatCard({ label, value, color, icon, hidden }) {
  if (hidden) return null;

  const colorStyles = {
    green: 'bg-green-50 border-green-100 text-green-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    red: 'bg-red-50 border-red-100 text-red-700',
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    gray: 'bg-gray-50 border-gray-100 text-gray-400',
  };

  const valueColor = colorStyles[color]?.split(' ').find((c) => c.startsWith('text-')) || 'text-gray-700';
  const cardStyle = colorStyles[color]?.replace(valueColor, '').trim() || 'bg-gray-50 border-gray-100';

  return (
    <div className={`rounded-xl border p-4 ${cardStyle}`}>
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className={`text-2xl font-bold ${valueColor}`}>{value}</span>
      </div>
      <div className="mt-1 text-xs text-gray-500">{label}</div>
    </div>
  );
}

function RecentRecordCard({ record, onClick }) {
  const statusClass = {
    pending: 'bg-amber-100 text-amber-700',
    synced: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    draft: 'bg-gray-100 text-gray-600',
  }[record.syncStatus] || 'bg-gray-100 text-gray-600';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-gray-100 bg-white p-3 text-left shadow-sm active:bg-gray-50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-800">
            {record.fullName || 'Unnamed'}
          </p>
          {record.cnicNumber && (
            <p className="text-xs text-gray-500">{record.cnicNumber}</p>
          )}
          <p className="text-xs text-gray-400">
            {[record.city, record.district].filter(Boolean).join(', ')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
            {record.syncStatus}
          </span>
          <span className="text-[10px] text-gray-400">{timeAgo(record.createdAt)}</span>
        </div>
      </div>
    </button>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-200" />
        ))}
      </div>
      <div className="h-14 rounded-xl bg-gray-200" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-12 rounded-xl bg-gray-200" />
        <div className="h-12 rounded-xl bg-gray-200" />
      </div>
      <div className="h-32 rounded-xl bg-gray-200" />
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    pending: 0,
    failed: 0,
    synced: 0,
  });
  const [recentRecords, setRecentRecords] = useState([]);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [agentName, setAgentName] = useState('');

  const touchStartY = useRef(0);
  const touchStartScrollTop = useRef(0);
  const pullTriggered = useRef(false);

  const loadDashboardData = useCallback(async () => {
    try {
      const [allRecords, agentNameSetting, lastSync] = await Promise.all([
        getAllRecords(),
        getSetting('agentName'),
        getSetting('lastSyncTime'),
      ]);

      const today = new Date().toDateString();
      const todayRecords = allRecords.filter(
        (record) => new Date(record.createdAt).toDateString() === today
      );

      setStats({
        total: allRecords.length,
        today: todayRecords.length,
        pending: allRecords.filter((record) => record.syncStatus === 'pending').length,
        failed: allRecords.filter((record) => record.syncStatus === 'failed').length,
        synced: allRecords.filter((record) => record.syncStatus === 'synced').length,
      });

      setRecentRecords(allRecords.slice(0, 5));
      setLastSyncTime(lastSync);
      setAgentName(agentNameSetting || '');
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();

    const handleFocus = () => {
      loadDashboardData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadDashboardData]);

  const handleTouchStart = (event) => {
    touchStartY.current = event.touches[0].clientY;
    const main = document.querySelector('main');
    touchStartScrollTop.current = main?.scrollTop || 0;
    pullTriggered.current = false;
  };

  const handleTouchMove = (event) => {
    const main = document.querySelector('main');
    const scrollTop = main?.scrollTop || 0;
    const currentY = event.touches[0].clientY;
    const pullDistance = currentY - touchStartY.current;

    if (scrollTop <= 0 && pullDistance > 60 && !pullTriggered.current) {
      pullTriggered.current = true;
      setIsRefreshing(true);
      loadDashboardData();
    }
  };

  const handleTouchEnd = () => {
    touchStartY.current = 0;
    touchStartScrollTop.current = 0;
  };

  return (
    <>
      <Head>
        <title>Dashboard | PM E-Fan Data Collection</title>
      </Head>

      <Layout title="PM E-Fan Data Collection 🇵🇰">
        {isRefreshing && (
          <div className="flex justify-center pt-4">
            <div
              className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent"
            />
          </div>
        )}

        <div
          className="space-y-4 px-4 py-4"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {agentName && (
            <div className="text-sm text-gray-600">
              Welcome, <span className="font-medium text-gray-800">{agentName}</span>
            </div>
          )}

          {isLoading ? (
            <DashboardSkeleton />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Today's Forms" value={stats.today} color="green" icon="📝" />
                <StatCard
                  label="Pending Sync"
                  value={stats.pending}
                  color={stats.pending > 0 ? 'amber' : 'green'}
                  icon="⏳"
                />
                <StatCard label="Total Records" value={stats.total} color="blue" icon="📊" />
                <StatCard
                  label="Failed Sync"
                  value={stats.failed}
                  color={stats.failed > 0 ? 'red' : 'gray'}
                  icon="❌"
                  hidden={stats.failed === 0}
                />
                {stats.failed === 0 && (
                  <StatCard label="Synced" value={stats.synced} color="green" icon="✅" />
                )}
              </div>

              <div className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                  Quick Actions
                </h2>

                <button
                  type="button"
                  onClick={() => router.push('/form')}
                  className="btn-primary flex w-full items-center justify-center gap-3 rounded-xl py-4 text-base font-semibold"
                >
                  <span className="text-2xl">📋</span>
                  Start New Form
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => router.push('/records')}
                    className="btn-secondary flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium"
                  >
                    📁 View Records
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push('/records?filter=pending')}
                    disabled={stats.pending === 0}
                    className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium ${
                      stats.pending > 0
                        ? 'bg-amber-500 text-white'
                        : 'btn-secondary opacity-50'
                    }`}
                  >
                    ⏳ Pending ({stats.pending})
                  </button>
                </div>
              </div>

              <SyncStatus compact={false} onSyncComplete={loadDashboardData} />

              {recentRecords.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                      Recent Forms
                    </h2>
                    <button
                      type="button"
                      onClick={() => router.push('/records')}
                      className="text-sm text-primary-600"
                    >
                      View all →
                    </button>
                  </div>

                  <div className="space-y-2">
                    {recentRecords.map((record) => (
                      <RecentRecordCard
                        key={record.id}
                        record={record}
                        onClick={() => router.push(`/form?id=${record.id}`)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {stats.total === 0 && (
                <div className="py-12 text-center">
                  <div className="mb-4 text-5xl">📋</div>
                  <h3 className="mb-2 font-semibold text-gray-700">No forms yet</h3>
                  <p className="mb-6 text-sm text-gray-500">
                    Tap &quot;Start New Form&quot; to collect your first consumer record
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </Layout>
    </>
  );
}
