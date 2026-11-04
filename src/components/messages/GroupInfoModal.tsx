import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Pencil, UserPlus, Link2, Check, X, Users, Crown, Shield, ShieldOff, LogOut, UserMinus, BellOff, Bell, Camera, Image, BarChart3, Plus, QrCode, Info, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CustomFilePicker } from '@/components/CustomFilePicker';
import { useQueryClient } from '@tanstack/react-query';
import FriendPicker from '@/components/circles/FriendPicker';
import { useGroupMembers, useGroupInfo, useGroupMute, useSharedMedia, useGroupPolls } from '@/hooks/useGroupManagement';
import { useChatMediaUrls } from '@/hooks/useChatMediaUrls';

/* ─────── Premium Dark Theme Styles ─────── */
const groupModalStyles = `
  @keyframes groupModalSlideUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .group-modal-card {
    animation: groupModalSlideUp 0.4s ease-out both;
  }

  /* Friend picker overlay */
  .g-friend-picker-overlay {
    position: absolute;
    inset: 0;
    z-index: 50;
    background: rgba(42,26,14,0.95);
    backdrop-filter: blur(8px);
    display: flex;
    flex-direction: column;
    padding: 16px;
    border-radius: 16px;
    animation: groupModalSlideUp 0.25s ease-out both;
  }

  .group-avatar-ring {
    background: conic-gradient(from 0deg, #E09F4D, #713A20, #FFE2BE, #E09F4D);
    border-radius: 50%;
    padding: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .group-avatar-ring .avatar-inner {
    border-radius: 50%;
    overflow: hidden;
    width: 80px;
    height: 80px;
  }

  .g-action-btn {
    transition: all 0.18s ease;
    cursor: pointer;
    background: none;
    border: none;
  }
  .g-action-btn:hover {
    background: rgba(224,159,77,0.12);
    box-shadow: 0 0 10px rgba(224,159,77,0.2);
    transform: scale(1.06);
  }

  @keyframes gTabExpand {
    from { width: 0; }
    to   { width: 100%; }
  }
  .g-tab-btn {
    position: relative;
    transition: color 0.15s;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0 4px 10px;
    font-size: 12px;
    font-weight: 600;
    color: rgba(255,226,190,0.4);
    white-space: nowrap;
  }
  .g-tab-btn::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    width: 0;
    background: #E09F4D;
    border-radius: 1px;
    transition: width 0.25s ease;
  }
  .g-tab-btn.active { color: #E09F4D; }
  .g-tab-btn.active::after { animation: gTabExpand 0.25s ease forwards; }

  .g-close-btn {
    transition: background 0.2s, transform 0.2s;
    cursor: pointer;
  }
  .g-close-btn:hover {
    background: rgba(255,255,255,0.15);
    transform: rotate(90deg);
  }

  .g-row-hover {
    cursor: pointer;
    border-radius: 8px;
    transition: background 0.15s;
  }
  .g-row-hover:hover {
    background: rgba(255,226,190,0.04);
  }

  .g-scroll::-webkit-scrollbar { width: 4px; }
  .g-scroll::-webkit-scrollbar-track { background: transparent; }
  .g-scroll::-webkit-scrollbar-thumb { background: rgba(255,226,190,0.08); border-radius: 10px; }

  .g-btn-outline {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgba(255,226,190,0.08);
    background: transparent;
    color: #FFE2BE;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .g-btn-outline:hover {
    background: rgba(255,226,190,0.04);
    border-color: rgba(255,226,190,0.15);
  }
  .g-btn-outline.danger {
    color: #f87171;
    border-color: rgba(248,113,113,0.15);
  }
  .g-btn-outline.danger:hover {
    background: rgba(248,113,113,0.06);
  }

  .g-btn-solid {
    padding: 6px 16px;
    border-radius: 8px;
    border: none;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .g-btn-solid:disabled { opacity: 0.4; cursor: not-allowed; }
  .g-btn-solid.primary { background: #E09F4D; color: #2a1a0e; }
  .g-btn-solid.ghost { background: transparent; color: rgba(255,226,190,0.5); }
  .g-btn-solid.ghost:hover { color: #FFE2BE; }
  .g-btn-solid.secondary { background: #3a2212; color: #FFE2BE; }

  .g-input {
    width: 100%;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255,226,190,0.12);
    background: #3a2212;
    color: #FFE2BE;
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
  }
  .g-input:focus { border-color: #E09F4D; }
  .g-input::placeholder { color: rgba(255,226,190,0.3); }

  .g-textarea {
    width: 100%;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255,226,190,0.12);
    background: #3a2212;
    color: #FFE2BE;
    font-size: 13px;
    outline: none;
    resize: vertical;
    min-height: 60px;
    font-family: inherit;
  }
  .g-textarea:focus { border-color: #E09F4D; }
  .g-textarea::placeholder { color: rgba(255,226,190,0.3); }

  .g-poll-bar {
    height: 6px;
    border-radius: 3px;
    background: rgba(255,226,190,0.08);
    overflow: hidden;
  }
  .g-poll-fill {
    height: 100%;
    border-radius: 3px;
    background: #E09F4D;
    transition: width 0.3s ease;
  }

  .g-member-actions {
    display: none;
    gap: 4px;
  }
  .g-member-row:hover .g-member-actions {
    display: flex;
  }
  .g-icon-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: rgba(255,226,190,0.5);
    transition: background 0.15s, color 0.15s;
  }
  .g-icon-btn:hover { background: rgba(255,226,190,0.08); color: #FFE2BE; }
  .g-icon-btn.danger { color: #f87171; }
  .g-icon-btn.danger:hover { background: rgba(248,113,113,0.08); }

  .g-media-cell {
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.2s ease;
    position: relative;
    border-radius: 6px;
    background: #3a2212;
  }
  .g-media-cell:hover { transform: scale(1.04); }
`;

interface Friend { id: string; name: string; username: string; avatar_url: string | null; initials: string; avatar_color: string; }

interface GroupInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  groupName: string;
  groupAvatarUrl: string | null;
  currentUserId: string;
  createdBy?: string;
}

type GTab = 'info' | 'members' | 'media' | 'polls';

const GroupInfoModal: React.FC<GroupInfoModalProps> = ({
  isOpen, onClose, conversationId, groupName, groupAvatarUrl, currentUserId, createdBy,
}) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<GTab>('info');

  // State
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(groupName);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editedDesc, setEditedDesc] = useState('');
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);
  const [isAddingSaving, setIsAddingSaving] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showMuteOptions, setShowMuteOptions] = useState(false);

  // Poll creation state
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollAnonymous, setPollAnonymous] = useState(false);
  const [pollMultiple, setPollMultiple] = useState(false);

  // Hooks
  const { members, isLoading: membersLoading, promoteToAdmin, demoteAdmin, removeMember, leaveGroup } = useGroupMembers(conversationId, isOpen);
  const { groupInfo, updateDescription, updateAvatar, updateName } = useGroupInfo(conversationId, isOpen);
  const { isMuted, mute, unmute } = useGroupMute(conversationId, currentUserId);
  const { data: sharedMedia = [] } = useSharedMedia(conversationId, isOpen);
  const privateMedia = useChatMediaUrls(sharedMedia.map(item => item.attachment_url), isOpen);
  const { polls, createPoll, endPoll, vote, unvote } = useGroupPolls(conversationId, currentUserId, isOpen);

  const resolvedCreatedBy = groupInfo?.created_by || createdBy;
  const isCreator = currentUserId === resolvedCreatedBy;
  const currentMember = members.find(m => m.id === currentUserId);
  const isAdmin = currentMember?.is_admin || isCreator;
  const inviteLink = `${window.location.origin}/messages?join_group=${conversationId}`;

  const handleSaveName = async () => {
    if (!editedName.trim()) return;
    await updateName.mutateAsync(editedName.trim());
    setIsEditingName(false);
  };

  const handleSaveDesc = async () => {
    await updateDescription.mutateAsync(editedDesc.trim());
    setIsEditingDesc(false);
  };

  const handleAddMembers = async () => {
    if (selectedFriends.length === 0) return;
    setIsAddingSaving(true);
    try {
      const { error } = await supabase.from('conversation_members').insert(
        selectedFriends.map(f => ({ conversation_id: conversationId, user_id: f.id }))
      );
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['group-members', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success(`Added ${selectedFriends.length} member(s)`);
      setIsAddingMembers(false);
      setSelectedFriends([]);
    } catch (err: any) {
      toast.error(err.code === '23505' ? 'Some members already in group' : 'Failed to add members');
    } finally {
      setIsAddingSaving(false);
    }
  };

  const handleCreatePoll = () => {
    const validOptions = pollOptions.filter(o => o.trim());
    if (!pollQuestion.trim() || validOptions.length < 2) {
      toast.error('Need a question and at least 2 options');
      return;
    }
    createPoll.mutate({ question: pollQuestion, options: validOptions, is_anonymous: pollAnonymous, is_multiple_choice: pollMultiple });
    setPollQuestion(''); setPollOptions(['', '']); setShowPollForm(false);
    setPollAnonymous(false); setPollMultiple(false);
  };

  const handleLeave = () => {
    if (confirm('Are you sure you want to leave this group?')) {
      leaveGroup.mutate(currentUserId, { onSuccess: onClose });
    }
  };

  const displayAvatar = groupInfo?.group_avatar_url || groupAvatarUrl;
  const displayName = groupInfo?.group_name || groupName;
  const description = groupInfo?.description || '';

  const tabDefs: { key: GTab; label: string }[] = [
    { key: 'info', label: 'Info' },
    { key: 'members', label: `Members (${members.length})` },
    { key: 'media', label: `Media (${sharedMedia.length})` },
    { key: 'polls', label: `Polls (${polls.length})` },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent
        className="max-w-[380px] p-0 overflow-hidden border-none shadow-[0_24px_64px_rgba(0,0,0,0.6)] outline-none rounded-[16px] gap-0"
        style={{ background: 'rgba(42,26,14,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
        aria-describedby={undefined}
      >
        <VisuallyHidden.Root><DialogTitle>Group Info</DialogTitle></VisuallyHidden.Root>
        <style dangerouslySetInnerHTML={{ __html: groupModalStyles }} />

        <div className="group-modal-card" style={{ position: 'relative' }}>
          {/* ─── Header with Gradient ─── */}
          <div
            className="relative overflow-hidden"
            style={{ background: 'linear-gradient(160deg, #9B5230 0%, #713A20 60%, #4d2714 100%)', padding: '20px 16px 24px' }}
          >
            <button
              onClick={onClose}
              className="g-close-btn absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.15)', color: 'rgba(255,226,190,0.7)' }}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center mt-2">
              {/* Avatar with ring */}
              <div className="relative mb-4">
                <div className="group-avatar-ring">
                  <div className="avatar-inner">
                    <Avatar className="w-full h-full" style={{ width: 80, height: 80 }}>
                      <AvatarImage src={displayAvatar || undefined} />
                      <AvatarFallback
                        className="text-2xl font-bold text-white"
                        style={{ background: '#9B5230', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {displayName.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                {isAdmin && (
                  <CustomFilePicker
                    onUpload={async (file) => { await updateAvatar.mutateAsync(file as File); }}
                    accept="image/*"
                    hidePreviewList
                  >
                    <button
                      className="absolute bottom-0 right-0 rounded-full p-1.5 shadow-md"
                      style={{ background: '#E09F4D', color: '#2a1a0e' }}
                    >
                      <Camera className="h-3.5 w-3.5" />
                    </button>
                  </CustomFilePicker>
                )}
              </div>

              {/* Name */}
              {isEditingName ? (
                <div className="flex items-center gap-2 w-full max-w-xs">
                  <input
                    className="g-input text-center"
                    value={editedName}
                    onChange={e => setEditedName(e.target.value)}
                    autoFocus
                  />
                  <button className="g-icon-btn" onClick={handleSaveName} disabled={updateName.isPending}>
                    {updateName.isPending ? <SerkleLoader size="xs" className="text-current" style={{ color: '#E09F4D' }}/> : <Check className="h-4 w-4" style={{ color: '#4ade80' }} />}
                  </button>
                  <button className="g-icon-btn" onClick={() => { setIsEditingName(false); setEditedName(displayName); }}>
                    <X className="h-4 w-4" style={{ color: '#f87171' }} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="font-bold leading-tight text-center" style={{ fontSize: 20, color: '#FFE2BE' }}>
                    {displayName}
                  </h2>
                  {isAdmin && (
                    <button className="g-icon-btn" onClick={() => setIsEditingName(true)}>
                      <Pencil className="h-3.5 w-3.5" style={{ color: 'rgba(255,226,190,0.5)' }} />
                    </button>
                  )}
                </div>
              )}
              <span style={{ fontSize: 13, color: 'rgba(255,226,190,0.5)' }}>
                {members.length} members
              </span>
            </div>
          </div>

          {/* ─── Action Buttons ─── */}
          <div
            className="flex justify-around items-center py-3"
            style={{ background: '#2a1a0e', borderBottom: '1px solid rgba(255,226,190,0.08)' }}
          >
            {[
              { icon: <MessageSquare className="w-5 h-5" />, label: 'Message', accent: true, onClick: onClose },
              { icon: isMuted ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />, label: isMuted ? 'Unmute' : 'Mute', onClick: () => isMuted ? unmute.mutate() : setShowMuteOptions(!showMuteOptions) },
              { icon: <UserPlus className="w-5 h-5" />, label: 'Add', onClick: () => { setActiveTab('info'); setIsAddingMembers(true); } },
              { icon: <Link2 className="w-5 h-5" />, label: 'Invite', onClick: () => { navigator.clipboard.writeText(inviteLink); toast.success('Link copied'); } },
            ].map((btn) => (
              <button
                key={btn.label}
                onClick={btn.onClick}
                className="g-action-btn flex flex-col items-center gap-1.5 px-4 py-2 rounded-xl"
              >
                <span style={{ color: btn.accent ? '#E09F4D' : 'rgba(255,226,190,0.6)' }}>{btn.icon}</span>
                <span className="font-medium" style={{ fontSize: 11, color: btn.accent ? '#E09F4D' : 'rgba(255,226,190,0.6)' }}>
                  {btn.label}
                </span>
              </button>
            ))}
          </div>

          {/* Mute Options */}
          {showMuteOptions && !isMuted && (
            <div className="flex justify-center gap-2 py-2 px-4" style={{ background: '#2a1a0e', borderBottom: '1px solid rgba(255,226,190,0.08)' }}>
              {[{ label: '1 hour', value: '1h' as const }, { label: '24 hours', value: '24h' as const }, { label: 'Forever', value: 'forever' as const }].map(opt => (
                <button
                  key={opt.value}
                  className="g-btn-solid secondary"
                  onClick={() => { mute.mutate(opt.value); setShowMuteOptions(false); }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* ─── Tab Bar ─── */}
          <div
            className="flex gap-4 px-4 pt-2"
            style={{ borderBottom: '1px solid rgba(255,226,190,0.08)', background: '#2a1a0e' }}
          >
            {tabDefs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`g-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ─── Tab Content ─── */}
          <div className="g-scroll" style={{ height: 280, overflowY: 'auto', background: '#2a1a0e', padding: '8px 12px' }}>

            {/* ── Info Tab ── */}
            {activeTab === 'info' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Description */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,226,190,0.35)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Description
                  </div>
                  {isEditingDesc ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <textarea
                        className="g-textarea"
                        value={editedDesc}
                        onChange={e => setEditedDesc(e.target.value)}
                        placeholder="Group description..."
                        rows={3}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="g-btn-solid primary" onClick={handleSaveDesc} disabled={updateDescription.isPending}>Save</button>
                        <button className="g-btn-solid ghost" onClick={() => setIsEditingDesc(false)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="g-row-hover"
                      style={{ fontSize: 13, color: description ? '#FFE2BE' : 'rgba(255,226,190,0.3)', padding: '8px' }}
                      onClick={() => { if (isAdmin) { setEditedDesc(description); setIsEditingDesc(true); } }}
                    >
                      {description || (isAdmin ? 'Tap to add description...' : 'No description')}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button className="g-btn-outline" onClick={() => setIsAddingMembers(true)}>
                    <UserPlus className="h-4 w-4" style={{ color: '#E09F4D' }} /> Add People
                  </button>
                  <button className="g-btn-outline" onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success('Link copied'); }}>
                    <Link2 className="h-4 w-4" style={{ color: '#E09F4D' }} /> Copy Invite Link
                  </button>
                  <button className="g-btn-outline" onClick={() => setShowQR(!showQR)}>
                    <QrCode className="h-4 w-4" style={{ color: '#E09F4D' }} /> {showQR ? 'Hide' : 'Show'} QR Code
                  </button>
                  {showQR && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 12, background: '#3a2212', borderRadius: 10 }}>
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(inviteLink)}`} alt="QR Code" style={{ width: 140, height: 140, borderRadius: 8 }} />
                    </div>
                  )}
                  <button className="g-btn-outline danger" onClick={handleLeave}>
                    <LogOut className="h-4 w-4" /> Leave Group
                  </button>
                </div>

                {/* Add Members — handled by floating overlay */}
              </div>
            )}

            {/* ── Members Tab ── */}
            {activeTab === 'members' && (
              membersLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                  <SerkleLoader size="sm" className="text-current" style={{ color: 'rgba(255,226,190,0.3)' }}/>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {members.map(member => (
                    <div
                      key={member.id}
                      className="g-member-row g-row-hover"
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px' }}
                    >
                      <Avatar style={{ width: 40, height: 40 }}>
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback className="text-sm font-medium text-white" style={{ background: '#9B5230' }}>
                          {member.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="truncate" style={{ fontSize: 14, fontWeight: 500, color: '#FFE2BE'  }}>{member.name}</span>
                          {member.is_creator && <Crown className="flex-shrink-0" style={{ width: 14, height: 14, color: '#f59e0b' }} />}
                          {member.is_admin && !member.is_creator && <Shield className="flex-shrink-0" style={{ width: 14, height: 14, color: '#E09F4D' }} />}
                          {member.id === currentUserId && <span style={{ fontSize: 11, color: 'rgba(255,226,190,0.35)' }}>(You)</span>}
                        </div>
                        <span className="truncate" style={{ fontSize: 12, color: 'rgba(255,226,190,0.4)', display: 'block' }}>@{member.username}</span>
                      </div>
                      {isAdmin && member.id !== currentUserId && !member.is_creator && (
                        <div className="g-member-actions">
                          {member.is_admin ? (
                            <button className="g-icon-btn" title="Remove admin" onClick={() => demoteAdmin.mutate(member.id)}>
                              <ShieldOff className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button className="g-icon-btn" title="Make admin" onClick={() => promoteToAdmin.mutate(member.id)}>
                              <Shield className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button className="g-icon-btn danger" title="Remove" onClick={() => removeMember.mutate(member.id)}>
                            <UserMinus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {/* ── Media Tab ── */}
            {activeTab === 'media' && (
              sharedMedia.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', color: 'rgba(255,226,190,0.2)' }}>
                  <Image style={{ width: 40, height: 40, marginBottom: 8 }} />
                  <p style={{ fontSize: 13 }}>No shared media yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1" style={{ overflow: 'hidden' }}>
                  {sharedMedia.map((item: any) => (
                    <div key={item.id} className="g-media-cell aspect-square">
                      {privateMedia.failed(item.attachment_url) ? (
                        <button type="button" onClick={privateMedia.retry} className="min-h-11 text-xs">Unavailable · Retry</button>
                      ) : !privateMedia.url(item.attachment_url) ? (
                        <SerkleLoader size="sm" label="Loading private attachment" />
                      ) : item.message_type?.startsWith('video') ? (
                        <video src={privateMedia.url(item.attachment_url)} className="w-full h-full object-cover" />
                      ) : (
                        <img src={privateMedia.url(item.attachment_url)} className="w-full h-full object-cover" alt="" loading="lazy" />
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {/* ── Polls Tab ── */}
            {activeTab === 'polls' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button className="g-btn-outline" onClick={() => setShowPollForm(!showPollForm)}>
                  <Plus className="h-4 w-4" style={{ color: '#E09F4D' }} /> Create Poll
                </button>

                {showPollForm && (
                  <div style={{ border: '1px solid rgba(255,226,190,0.1)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input className="g-input" placeholder="Ask a question..." value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} />
                    {pollOptions.map((opt, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6 }}>
                        <input className="g-input" placeholder={`Option ${i + 1}`} value={opt} onChange={e => { const n = [...pollOptions]; n[i] = e.target.value; setPollOptions(n); }} />
                        {i >= 2 && (
                          <button className="g-icon-btn" onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}>
                            <X className="h-3.5 w-3.5" style={{ color: '#f87171' }} />
                          </button>
                        )}
                      </div>
                    ))}
                    {pollOptions.length < 10 && (
                      <button className="g-btn-solid ghost" style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => setPollOptions([...pollOptions, ''])}>
                        <Plus className="h-3.5 w-3.5" /> Add option
                      </button>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,226,190,0.5)' }}>Anonymous</span>
                      <Switch checked={pollAnonymous} onCheckedChange={setPollAnonymous} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,226,190,0.5)' }}>Multiple choice</span>
                      <Switch checked={pollMultiple} onCheckedChange={setPollMultiple} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="g-btn-solid primary" onClick={handleCreatePoll} disabled={createPoll.isPending}>Create</button>
                      <button className="g-btn-solid ghost" onClick={() => setShowPollForm(false)}>Cancel</button>
                    </div>
                  </div>
                )}

                {polls.map((poll: any) => {
                  const options = poll.options as any[];
                  const votes = poll.poll_votes || [];
                  const totalVotes = votes.length;
                  const userVotes = votes.filter((v: any) => v.user_id === currentUserId).map((v: any) => v.option_id);
                  const isPollCreator = poll.creator_id === currentUserId;
                  const isEnded = poll.status === 'ended';

                  return (
                    <div
                      key={poll.id}
                      style={{
                        border: `1px solid ${isEnded ? 'rgba(255,226,190,0.04)' : 'rgba(255,226,190,0.08)'}`,
                        borderRadius: 12,
                        padding: 12,
                        opacity: isEnded ? 0.6 : 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <BarChart3 style={{ width: 16, height: 16, color: '#E09F4D' }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#FFE2BE' }}>{poll.question}</span>
                        </div>
                        {isPollCreator && !isEnded && (
                          <button className="g-btn-solid ghost" style={{ fontSize: 11, color: '#f87171' }} onClick={() => endPoll.mutate(poll.id)}>End</button>
                        )}
                      </div>
                      {isEnded && <span style={{ fontSize: 11, color: '#f87171', fontWeight: 500 }}>Poll ended</span>}
                      {poll.is_anonymous && <span style={{ fontSize: 11, color: 'rgba(255,226,190,0.35)' }}>Anonymous poll</span>}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {options.map((opt: any) => {
                          const optVotes = votes.filter((v: any) => v.option_id === opt.id).length;
                          const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
                          const hasVoted = userVotes.includes(opt.id);

                          return (
                            <button
                              key={opt.id}
                              style={{ textAlign: 'left', background: 'none', border: 'none', cursor: isEnded ? 'default' : 'pointer', padding: 0 }}
                              disabled={isEnded}
                              onClick={() => hasVoted ? unvote.mutate({ pollId: poll.id, optionId: opt.id }) : vote.mutate({ pollId: poll.id, optionId: opt.id })}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                <span style={{ fontSize: 12, color: hasVoted ? '#E09F4D' : '#FFE2BE', fontWeight: hasVoted ? 600 : 400 }}>{opt.text}</span>
                                <span style={{ fontSize: 11, color: 'rgba(255,226,190,0.4)' }}>{pct}%</span>
                              </div>
                              <div className="g-poll-bar">
                                <div className="g-poll-fill" style={{ width: `${pct}%` }} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <span style={{ fontSize: 11, color: 'rgba(255,226,190,0.35)' }}>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
                    </div>
                  );
                })}

                {polls.length === 0 && !showPollForm && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'rgba(255,226,190,0.2)' }}>
                    <BarChart3 style={{ width: 40, height: 40, marginBottom: 8 }} />
                    <p style={{ fontSize: 13 }}>No polls yet</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── Friend Picker Floating Overlay ─── */}
          {isAddingMembers && (
            <div className="g-friend-picker-overlay">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#FFE2BE' }}>Add Members</h3>
                <button className="g-icon-btn" onClick={() => { setIsAddingMembers(false); setSelectedFriends([]); }}>
                  <X className="h-4 w-4" style={{ color: '#f87171' }} />
                </button>
              </div>
              <div style={{ flex: 1, overflow: 'auto', marginBottom: 12 }}>
                <FriendPicker multiSelect selected={selectedFriends} onSelect={setSelectedFriends} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="g-btn-solid primary" style={{ flex: 1 }} onClick={handleAddMembers} disabled={selectedFriends.length === 0 || isAddingSaving}>
                  {isAddingSaving && <SerkleLoader size="xs" className="text-current" style={{ marginRight: 4 }}/>}
                  Add {selectedFriends.length > 0 ? `(${selectedFriends.length})` : ''}
                </button>
                <button className="g-btn-solid ghost" onClick={() => { setIsAddingMembers(false); setSelectedFriends([]); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GroupInfoModal;
