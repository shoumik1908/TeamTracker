import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Power, KeyRound, AlertTriangle, Search } from 'lucide-react';
import { adminApi } from '../lib/api';
import { getInitials } from '../lib/utils';

export default function AdminCredentialsPage() {
  const qc = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: users, isLoading, isError, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.getUsers().then(res => res.data)
  });

  const { data: roles } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => adminApi.getRoles().then(res => res.data)
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) => 
      adminApi.updateRole(userId, roleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] })
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) => 
      adminApi.updateStatus(userId, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] })
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (userId: string) => adminApi.resetPassword(userId),
    onSuccess: () => {
      alert('Password reset successfully to the default (firstname+xebia)');
      setSelectedUser(null);
    }
  });

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    
    // Sort alphabetically by name
    const sorted = [...users].sort((a: any, b: any) => 
      (a.name || '').localeCompare(b.name || '')
    );
    
    if (!searchQuery.trim()) return sorted;
    
    const query = searchQuery.toLowerCase();
    return sorted.filter((u: any) => 
      u.name?.toLowerCase().includes(query) || 
      u.email?.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  if (isLoading) return <div className="p-8 text-center text-white/50">Loading users...</div>;
  
  if (isError) return (
    <div className="p-8 text-center text-red-500">
      Error loading users: {(error as Error)?.message || 'Unknown error'}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
            <ShieldCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Access Management</h1>
            <p className="text-white/50">Manage team credentials, roles, and system access</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
          <input 
            type="text" 
            placeholder="Search by name or email..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>
        <div className="text-sm text-white/50">
          Showing {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="bg-[#1c1926] border border-white/10 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-white/50 uppercase text-[11px] font-semibold">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u: any) => (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold flex-shrink-0">
                          {getInitials(u.name)}
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{u.name}</div>
                          <div className="text-white/50 text-xs">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={u.roleId}
                        onChange={(e) => updateRoleMutation.mutate({ userId: u.id, roleId: e.target.value })}
                        className="text-sm bg-transparent border-none text-foreground focus:ring-0 cursor-pointer font-medium"
                      >
                        {roles?.filter((r: any) => r.name !== 'Manager').map((r: any) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => updateStatusMutation.mutate({ userId: u.id, isActive: !u.isActive })}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                          u.isActive 
                            ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        {u.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedUser(u)}
                        className="p-2 text-white/50 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                        title="Reset Password"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-white/50">
                    No users found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset Password Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-6">
            <div className="flex items-center gap-3 mb-4 text-amber-600 dark:text-amber-500">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-semibold text-foreground">Confirm Password Reset</h3>
            </div>
            <p className="text-white/50 text-sm mb-6">
              Are you sure you want to reset the password for <strong>{selectedUser.name}</strong>? 
              This will set their password to the default format and force them to change it on their next login.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 text-sm font-medium text-white/50 hover:text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => resetPasswordMutation.mutate(selectedUser.id)}
                disabled={resetPasswordMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {resetPasswordMutation.isPending ? 'Resetting...' : 'Yes, Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
