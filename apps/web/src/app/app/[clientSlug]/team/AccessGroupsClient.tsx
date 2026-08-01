'use client';

import { useState } from 'react';

export interface Group {
  id: string;
  name: string;
  permissions: Record<string, boolean>;
  member_count: number;
}

export interface GroupDetail {
  id: string;
  name: string;
  permissions: Record<string, boolean>;
  members: { id: string; email: string; client_role: string }[];
}

export interface User {
  id: string;
  email: string;
  client_role: string;
  access_groups: { id: string; name: string }[];
}

const ALL_PERMISSIONS: { key: string; label: string }[] = [
  { key: 'create_concepts', label: 'Create concepts' },
  { key: 'approve', label: 'Approve content' },
  { key: 'connect_social', label: 'Connect social accounts' },
  { key: 'view_analytics', label: 'View analytics' },
  { key: 'manage_campaigns', label: 'Manage campaigns' },
];

interface Props {
  clientSlug: string;
  groups: Group[];
  users: User[];
}

export function AccessGroupsClient({ clientSlug: _clientSlug, groups: initialGroups, users: initialUsers }: Props) {
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [users] = useState<User[]>(initialUsers);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupDetail, setGroupDetail] = useState<GroupDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // New group modal state
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPerms, setNewPerms] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Add member state
  const [addEmail, setAddEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState('');

  // Edit permissions state
  const [editPerms, setEditPerms] = useState<Record<string, boolean>>({});
  const [savingPerms, setSavingPerms] = useState(false);
  const [savePermsError, setSavePermsError] = useState('');
  const [savePermsSaved, setSavePermsSaved] = useState(false);

  async function selectGroup(id: string) {
    setSelectedGroupId(id);
    setGroupDetail(null);
    setLoadingDetail(true);
    setAddMemberError('');
    setSavePermsError('');
    setSavePermsSaved(false);
    const res = await fetch(`/api/access-groups/${id}`);
    if (res.ok) {
      const detail: GroupDetail = await res.json();
      setGroupDetail(detail);
      setEditPerms({ ...detail.permissions });
    }
    setLoadingDetail(false);
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) { setCreateError('Name is required'); return; }
    setCreating(true); setCreateError('');
    const res = await fetch('/api/access-groups', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), permissions: newPerms }),
    });
    if (res.ok) {
      const created: Group & { member_count?: number } = await res.json();
      setGroups(prev => [...prev, { ...created, member_count: 0 }]);
      setShowNewModal(false);
      setNewName('');
      setNewPerms({});
    } else {
      const d = await res.json();
      setCreateError(d.error ?? 'Failed to create group');
    }
    setCreating(false);
  }

  async function deleteGroup(id: string) {
    if (!confirm('Delete this access group? This cannot be undone.')) return;
    const res = await fetch(`/api/access-groups/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setGroups(prev => prev.filter(g => g.id !== id));
      if (selectedGroupId === id) { setSelectedGroupId(null); setGroupDetail(null); }
    }
  }

  async function savePermissions() {
    if (!selectedGroupId) return;
    setSavingPerms(true); setSavePermsError(''); setSavePermsSaved(false);
    const res = await fetch(`/api/access-groups/${selectedGroupId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ permissions: editPerms }),
    });
    if (res.ok) {
      setSavePermsSaved(true);
      setGroups(prev => prev.map(g => g.id === selectedGroupId ? { ...g, permissions: editPerms } : g));
      setGroupDetail(prev => prev ? { ...prev, permissions: editPerms } : prev);
    } else {
      const d = await res.json();
      setSavePermsError(d.error ?? 'Failed to save permissions');
    }
    setSavingPerms(false);
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!addEmail.trim() || !selectedGroupId) return;
    setAddingMember(true); setAddMemberError('');
    const res = await fetch(`/api/access-groups/${selectedGroupId}/members`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: addEmail.trim() }),
    });
    if (res.ok) {
      setAddEmail('');
      // Refresh detail to pick up new member
      await selectGroup(selectedGroupId);
    } else {
      const d = await res.json();
      setAddMemberError(d.error ?? 'Failed to add member');
    }
    setAddingMember(false);
  }

  async function removeMember(userId: string) {
    if (!selectedGroupId) return;
    const res = await fetch(`/api/access-groups/${selectedGroupId}/members`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      setGroupDetail(prev =>
        prev ? { ...prev, members: prev.members.filter(m => m.id !== userId) } : prev,
      );
      setGroups(prev =>
        prev.map(g => g.id === selectedGroupId ? { ...g, member_count: Math.max(0, g.member_count - 1) } : g),
      );
    }
  }

  const inputCls = 'rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] w-full';
  const btnPrimary = 'rounded-[var(--brand-radius)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50';
  const btnGhost = 'rounded-[var(--brand-radius)] border border-black/15 px-4 py-2 text-sm hover:bg-black/5 disabled:opacity-50';

  return (
    <>
      {/* Two-panel layout: Left = groups list, Right = group detail */}
      <div className="flex gap-6 mt-6">
        {/* Left panel: groups */}
        <div className="w-72 shrink-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--brand-ink)]">Access groups</h2>
            <button
              className={btnPrimary}
              onClick={() => { setShowNewModal(true); setCreateError(''); setNewName(''); setNewPerms({}); }}
            >
              New group
            </button>
          </div>
          {groups.length === 0 && (
            <p className="text-sm text-black/40 py-4 text-center">No groups yet.</p>
          )}
          <ul className="flex flex-col gap-1">
            {groups.map((g) => (
              <li key={g.id}>
                <button
                  onClick={() => selectGroup(g.id)}
                  className={`w-full text-left rounded-[var(--brand-radius)] px-3 py-2.5 text-sm transition-colors ${
                    selectedGroupId === g.id
                      ? 'bg-[var(--brand-primary)] text-white'
                      : 'hover:bg-[var(--brand-primary)]/10 text-[var(--brand-ink)]'
                  }`}
                >
                  <span className="font-medium">{g.name}</span>
                  <span className={`ml-2 text-xs ${selectedGroupId === g.id ? 'text-white/70' : 'text-black/40'}`}>
                    {g.member_count} member{g.member_count !== 1 ? 's' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Right panel: group detail */}
        <div className="flex-1 min-w-0">
          {!selectedGroupId && (
            <div className="flex items-center justify-center h-48 rounded-xl border border-dashed border-black/15">
              <p className="text-sm text-black/40">Select a group to view details</p>
            </div>
          )}

          {selectedGroupId && loadingDetail && (
            <div className="flex items-center justify-center h-48">
              <span className="text-sm text-black/40">Loading…</span>
            </div>
          )}

          {selectedGroupId && !loadingDetail && groupDetail && (
            <div className="flex flex-col gap-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--brand-ink)]">{groupDetail.name}</h2>
                <button
                  onClick={() => deleteGroup(groupDetail.id)}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  Delete group
                </button>
              </div>

              {/* Permissions */}
              <section className="rounded-xl border border-black/10 p-4 flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-[var(--brand-ink)]">Permissions</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {ALL_PERMISSIONS.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-[var(--brand-ink)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editPerms[key] === true}
                        onChange={(e) => setEditPerms(p => ({ ...p, [key]: e.target.checked }))}
                        className="accent-[var(--brand-primary)] h-4 w-4"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                {savePermsError && <p className="text-xs text-red-600">{savePermsError}</p>}
                {savePermsSaved && <p className="text-xs text-green-600">Permissions saved.</p>}
                <button className={`${btnPrimary} self-start`} onClick={savePermissions} disabled={savingPerms}>
                  {savingPerms ? 'Saving…' : 'Save permissions'}
                </button>
              </section>

              {/* Members */}
              <section className="rounded-xl border border-black/10 p-4 flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-[var(--brand-ink)]">Members</h3>
                {groupDetail.members.length === 0 && (
                  <p className="text-sm text-black/40">No members in this group.</p>
                )}
                <ul className="flex flex-col gap-1 divide-y divide-black/5">
                  {groupDetail.members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between py-2">
                      <div>
                        <span className="text-sm text-[var(--brand-ink)]">{m.email}</span>
                        <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 text-xs text-black/50">{m.client_role}</span>
                      </div>
                      <button
                        onClick={() => removeMember(m.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>

                {/* Add member form */}
                <form onSubmit={addMember} className="flex gap-2 mt-1">
                  <input
                    type="email"
                    placeholder="Add by email…"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    className={inputCls}
                  />
                  <button type="submit" className={btnGhost} disabled={addingMember || !addEmail.trim()}>
                    {addingMember ? 'Adding…' : 'Add'}
                  </button>
                </form>
                {addMemberError && <p className="text-xs text-red-600">{addMemberError}</p>}
              </section>
            </div>
          )}
        </div>
      </div>

      {/* New Group Modal */}
      {showNewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewModal(false); }}
        >
          <form
            onSubmit={createGroup}
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md flex flex-col gap-4"
          >
            <h2 className="text-lg font-semibold text-[var(--brand-ink)]">New access group</h2>

            <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--brand-ink)]">
              Group name
              <input
                type="text"
                placeholder="e.g. Content team"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className={inputCls}
                autoFocus
              />
            </label>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-[var(--brand-ink)] mb-1">Permissions</legend>
              <div className="grid grid-cols-2 gap-2">
                {ALL_PERMISSIONS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-[var(--brand-ink)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPerms[key] === true}
                      onChange={(e) => setNewPerms(p => ({ ...p, [key]: e.target.checked }))}
                      className="accent-[var(--brand-primary)] h-4 w-4"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            {createError && <p className="text-sm text-red-600">{createError}</p>}

            <div className="flex justify-end gap-3 mt-2">
              <button type="button" className={btnGhost} onClick={() => setShowNewModal(false)}>
                Cancel
              </button>
              <button type="submit" className={btnPrimary} disabled={creating}>
                {creating ? 'Creating…' : 'Create group'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
