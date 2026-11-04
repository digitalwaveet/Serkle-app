import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
    ImageIcon, LinkIcon, MicIcon, Play, Pause, VideoIcon, User, Users,
    Phone, AtSign, Calendar, BellOff, MoreHorizontal, MessageSquare,
    X, PhoneCall, FileText, Headphones, Eye, Trash2
} from 'lucide-react';
import { format, differenceInYears } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useChatMediaUrls } from '@/hooks/useChatMediaUrls';
import { SerkleLoader } from '@/components/ui/SerkleLoader';

/* ─────────── CSS Keyframes & Styles ─────────── */
const modalStyles = `
  @keyframes profileModalSlideUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .profile-modal-card {
    animation: profileModalSlideUp 0.4s ease-out both;
  }
  .profile-modal-card .flex::-webkit-scrollbar { display: none; }

  /* Static gradient ring (no rotation) */
  .avatar-gradient-ring {
    background: conic-gradient(from 0deg, #E09F4D, #713A20, #FFE2BE, #E09F4D);
    border-radius: 50%;
    padding: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .avatar-gradient-ring .avatar-inner {
    border-radius: 50%;
    overflow: hidden;
    width: 96px;
    height: 96px;
  }

  .action-btn-glow {
    transition: all 0.18s ease;
    cursor: pointer;
  }
  .action-btn-glow:hover {
    background: rgba(224,159,77,0.12);
    box-shadow: 0 0 10px rgba(224,159,77,0.2);
    transform: scale(1.06);
  }

  .info-row-hover {
    cursor: pointer;
    border-radius: 8px;
    padding: 14px 8px;
    transition: background 0.15s;
  }
  .info-row-hover:hover {
    background: rgba(255,226,190,0.04);
  }

  @keyframes tabUnderlineExpand {
    from { width: 0; }
    to   { width: 100%; }
  }
  .profile-tab-btn {
    position: relative;
    transition: color 0.15s;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0 2px 12px;
    font-size: 12px;
    font-weight: 600;
    color: rgba(255,226,190,0.4);
    white-space: nowrap;
  }
  .profile-tab-btn::after {
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
  .profile-tab-btn.active {
    color: #E09F4D;
  }
  .profile-tab-btn.active::after {
    animation: tabUnderlineExpand 0.25s ease forwards;
  }

  .media-grid-cell {
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.2s ease;
    position: relative;
  }
  .media-grid-cell:hover {
    transform: scale(1.04);
  }
  .media-grid-cell::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(224,159,77,0);
    transition: background 0.2s ease;
    pointer-events: none;
  }
  .media-grid-cell:hover::after {
    background: rgba(224,159,77,0.08);
  }

  @keyframes waveBar {
    0%, 100% { height: 6px; }
    50% { height: var(--bar-h); }
  }
  .wave-bar {
    width: 3px;
    border-radius: 999px;
    background: #E09F4D;
    animation: waveBar 0.8s ease-in-out infinite alternate;
  }

  .close-btn-rotate {
    transition: background 0.2s, transform 0.2s;
    cursor: pointer;
  }
  .close-btn-rotate:hover {
    background: rgba(255,255,255,0.15);
    transform: rotate(90deg);
  }

  .profile-custom-scroll::-webkit-scrollbar { width: 4px; }
  .profile-custom-scroll::-webkit-scrollbar-track { background: transparent; }
  .profile-custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,226,190,0.08); border-radius: 10px; }

  /* Context menu */
  .ctx-menu-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0,0,0,0.3);
  }
  .ctx-menu {
    position: fixed;
    z-index: 201;
    background: #3a2212;
    border: 1px solid rgba(255,226,190,0.12);
    border-radius: 12px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.5);
    padding: 4px;
    min-width: 160px;
    animation: profileModalSlideUp 0.15s ease-out both;
  }
  .ctx-menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    color: #FFE2BE;
    transition: background 0.12s;
    width: 100%;
    border: none;
    background: none;
    text-align: left;
  }
  .ctx-menu-item:hover {
    background: rgba(255,226,190,0.06);
  }
  .ctx-menu-item.danger {
    color: #f87171;
  }
  .ctx-menu-item.danger:hover {
    background: rgba(248,113,113,0.08);
  }
`;

type TabKey = 'photos' | 'videos' | 'files' | 'links' | 'audio' | 'voice';

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    messageId: string;
    conversationId: string;
    type: string;
}

interface ChatMediaGalleryModalProps {
    isOpen: boolean;
    onClose: () => void;
    messages: any[];
    profileName: string;
    profileAvatar?: string | null;
    profileInitials: string;
    isGroup: boolean;
    memberCount?: number;
    otherUserId?: string | null;
    otherUserUsername?: string | null;
    onViewProfile: () => void;
    onMediaSelect?: (url: string, type: 'photo' | 'video') => void;
    conversationId?: string;
}

const ChatMediaGalleryModal: React.FC<ChatMediaGalleryModalProps> = ({
    isOpen,
    onClose,
    messages: sourceMessages,
    profileName,
    profileAvatar,
    profileInitials,
    isGroup,
    memberCount,
    otherUserId,
    otherUserUsername,
    onViewProfile,
    onMediaSelect,
    conversationId
}) => {
    const privateMedia = useChatMediaUrls(sourceMessages.map(message => message.attachment_url), isOpen);
    const messages = sourceMessages.map(message => ({ ...message, attachment_ref: message.attachment_url, attachment_url: privateMedia.url(message.attachment_url) }));
    const [activeTab, setActiveTab] = useState<TabKey>('photos');
    const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [ctxMenu, setCtxMenu] = useState<ContextMenuState>({
        visible: false, x: 0, y: 0, messageId: '', conversationId: '', type: ''
    });
    const navigate = useNavigate();

    const [extraInfo, setExtraInfo] = useState<{
        phone?: string;
        birthday?: string;
        birthdayRaw?: string;
        username?: string;
        bio?: string;
    }>({});

    // Fetch extra profile info for private chats
    useEffect(() => {
        if (isOpen && otherUserId && !isGroup) {
            const fetchProfile = async () => {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('phone, birthday, username, bio')
                    .eq('id', otherUserId)
                    .single();
                
                if (!error && data) {
                    setExtraInfo({
                        phone: data.phone || '',
                        birthday: data.birthday ? format(new Date(data.birthday), 'MMM d, yyyy') : '',
                        birthdayRaw: data.birthday || '',
                        username: data.username || otherUserUsername || '',
                        bio: data.bio || ''
                    });
                }
            };
            fetchProfile();
        }
    }, [isOpen, otherUserId, isGroup, otherUserUsername]);

    // Categorize messages into 6 groups
    const categorisedItems = useMemo(() => {
        const photos: any[] = [];
        const videos: any[] = [];
        const files: any[] = [];
        const links: any[] = [];
        const audio: any[] = [];
        const voice: any[] = [];
        const urlRegex = /(https?:\/\/[^\s]+)/g;

        messages.forEach((msg) => {
            const type = msg.message_type || 'text';

            if (type === 'photo' && msg.attachment_url) {
                photos.push(msg);
            } else if (type === 'video' && msg.attachment_url) {
                videos.push(msg);
            } else if (type === 'voice' && msg.attachment_url) {
                voice.push(msg);
            } else if (type === 'audio' && msg.attachment_url) {
                audio.push(msg);
            } else if ((type === 'file' || type === 'document' || type === 'pdf') && msg.attachment_url) {
                files.push(msg);
            }

            if (msg.content) {
                const foundLinks = msg.content.match(urlRegex);
                if (foundLinks) {
                    foundLinks.forEach((link: string) => {
                        links.push({
                            id: `${msg.id}-${link}`,
                            url: link,
                            created_at: msg.created_at,
                            sender_id: msg.sender_id,
                            message_id: msg.id,
                            conversation_id: msg.conversation_id
                        });
                    });
                }
            }
        });

        const sortByDate = (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        photos.sort(sortByDate);
        videos.sort(sortByDate);
        files.sort(sortByDate);
        links.sort(sortByDate);
        audio.sort(sortByDate);
        voice.sort(sortByDate);

        return { photos, videos, files, links, audio, voice };
    }, [messages]);

    const age = useMemo(() => {
        if (!extraInfo.birthdayRaw) return null;
        try { return differenceInYears(new Date(), new Date(extraInfo.birthdayRaw)); }
        catch { return null; }
    }, [extraInfo.birthdayRaw]);

    // Voice playback
    const toggleVoice = useCallback((msgId: string, url: string) => {
        if (playingVoiceId === msgId) {
            audioRef.current?.pause();
            setPlayingVoiceId(null);
            return;
        }
        if (audioRef.current) {
            audioRef.current.pause();
        }
        const a = new Audio(url);
        audioRef.current = a;
        a.play().catch(console.error);
        a.onended = () => setPlayingVoiceId(null);
        setPlayingVoiceId(msgId);
    }, [playingVoiceId]);

    // Cleanup audio on unmount / close
    useEffect(() => {
        if (!isOpen && audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
            setPlayingVoiceId(null);
        }
    }, [isOpen]);

    // Long-press handler (works on both touch and mouse)
    const startLongPress = useCallback((e: React.TouchEvent | React.MouseEvent, msgId: string, convId: string, itemType: string) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        longPressTimer.current = setTimeout(() => {
            setCtxMenu({
                visible: true,
                x: Math.min(clientX, window.innerWidth - 180),
                y: Math.min(clientY, window.innerHeight - 120),
                messageId: msgId,
                conversationId: convId,
                type: itemType
            });
        }, 500);
    }, []);

    const cancelLongPress = useCallback(() => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    }, []);

    const handleCtxView = useCallback(() => {
        const msgId = ctxMenu.messageId;
        const convId = ctxMenu.conversationId || conversationId;
        setCtxMenu(prev => ({ ...prev, visible: false }));
        onClose();
        // Navigate to the message in the chat
        if (convId) {
            navigate(`/messages?conversationId=${convId}&messageId=${msgId}`);
        }
    }, [ctxMenu, conversationId, onClose, navigate]);

    const handleCtxDelete = useCallback(() => {
        // Placeholder for delete logic — just close for now
        setCtxMenu(prev => ({ ...prev, visible: false }));
    }, []);

    const waveBars = [
        { h: '14px', delay: '0ms' },
        { h: '20px', delay: '80ms' },
        { h: '10px', delay: '160ms' },
        { h: '24px', delay: '240ms' },
        { h: '10px', delay: '160ms' },
        { h: '20px', delay: '80ms' },
        { h: '14px', delay: '0ms' },
    ];

    // Tab definitions
    const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
        { key: 'photos', label: 'Photo', icon: <ImageIcon className="w-3.5 h-3.5" /> },
        { key: 'videos', label: 'Video', icon: <VideoIcon className="w-3.5 h-3.5" /> },
        { key: 'files',  label: 'Files', icon: <FileText className="w-3.5 h-3.5" /> },
        { key: 'links',  label: 'Links', icon: <LinkIcon className="w-3.5 h-3.5" /> },
        { key: 'audio',  label: 'Audio', icon: <Headphones className="w-3.5 h-3.5" /> },
        { key: 'voice',  label: 'Voice', icon: <MicIcon className="w-3.5 h-3.5" /> },
    ];

    // Shared long-press props
    const longPressProps = (msgId: string, convId: string, type: string) => ({
        onTouchStart: (e: React.TouchEvent) => startLongPress(e, msgId, convId, type),
        onTouchEnd: cancelLongPress,
        onTouchMove: cancelLongPress,
        onContextMenu: (e: React.MouseEvent) => {
            e.preventDefault();
            startLongPress(e, msgId, convId, type);
            // Trigger immediately on right-click
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
            setCtxMenu({
                visible: true,
                x: Math.min(e.clientX, window.innerWidth - 180),
                y: Math.min(e.clientY, window.innerHeight - 120),
                messageId: msgId,
                conversationId: convId,
                type
            });
        },
    });

    /* ────────────── Empty State ────────────── */
    const EmptyState = ({ icon: Icon, label }: { icon: any; label: string }) => (
        <div className="flex flex-col items-center justify-center py-12" style={{ color: 'rgba(255,226,190,0.2)' }}>
            <Icon className="w-10 h-10 mb-2" />
            <p style={{ fontSize: 13 }}>No {label} yet</p>
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className="max-w-[380px] p-0 overflow-hidden border-none shadow-[0_24px_64px_rgba(0,0,0,0.6)] outline-none rounded-[16px] gap-0"
                style={{ background: 'rgba(42,26,14,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
                aria-describedby={undefined}
            >
                <VisuallyHidden.Root><DialogTitle>Profile</DialogTitle></VisuallyHidden.Root>
                <style dangerouslySetInnerHTML={{ __html: modalStyles }} />

                <div className="profile-modal-card">
                    {sourceMessages.some(message => message.attachment_url?.startsWith('chat-media://') && !privateMedia.url(message.attachment_url) && !privateMedia.failed(message.attachment_url)) && (
                        <div className="flex justify-center p-3"><SerkleLoader size="sm" dark label="Loading private attachments" /></div>
                    )}
                    {sourceMessages.some(message => privateMedia.failed(message.attachment_url)) && (
                        <button type="button" className="min-h-11 w-full px-4 text-sm text-[#FFE2BE]" onClick={privateMedia.retry}>
                            Some attachments are unavailable · Retry
                        </button>
                    )}
                    {/* ─── Header ─── */}
                    <div
                        className="relative overflow-hidden"
                        style={{ background: 'linear-gradient(160deg, #9B5230 0%, #713A20 60%, #4d2714 100%)', padding: '20px 16px 24px' }}
                    >
                        <button
                            onClick={onClose}
                            className="close-btn-rotate absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-[#FFE2BE]/70"
                            style={{ background: 'rgba(0,0,0,0.15)' }}
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="flex flex-col items-center mt-2">
                            <div className="avatar-gradient-ring mb-4">
                                <div className="avatar-inner">
                                    <Avatar className="w-full h-full" style={{ width: 96, height: 96 }}>
                                        <AvatarImage src={profileAvatar || undefined} />
                                        <AvatarFallback
                                            className="text-3xl font-bold text-white"
                                            style={{ background: '#9B5230', width: 96, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            {isGroup ? <Users className="w-10 h-10" /> : profileInitials}
                                        </AvatarFallback>
                                    </Avatar>
                                </div>
                            </div>

                            <h2 className="font-bold leading-tight mb-1 text-center" style={{ fontSize: 20, color: '#FFE2BE' }}>
                                {profileName}
                            </h2>
                            <span style={{ fontSize: 13, color: 'rgba(255,226,190,0.5)' }}>
                                {isGroup ? `${memberCount || 0} members` : 'last seen recently'}
                            </span>
                        </div>
                    </div>

                    {/* ─── Action Buttons ─── */}
                    <div className="flex justify-around items-center py-4" style={{ background: '#2a1a0e', borderBottom: '1px solid rgba(255,226,190,0.08)' }}>
                        {[
                            { icon: <MessageSquare className="w-5 h-5" />, label: 'Message', onClick: () => { onClose(); onViewProfile(); } },
                            { icon: <BellOff className="w-5 h-5" />, label: 'Mute' },
                            { icon: <PhoneCall className="w-5 h-5" />, label: 'Call' },
                            { icon: <MoreHorizontal className="w-5 h-5" />, label: 'More' },
                        ].map((btn) => (
                            <button
                                key={btn.label}
                                onClick={btn.onClick}
                                className="action-btn-glow flex flex-col items-center gap-1.5 px-4 py-2 rounded-xl"
                            >
                                <span style={{ color: btn.label === 'Message' ? '#E09F4D' : 'rgba(255,226,190,0.6)' }}>{btn.icon}</span>
                                <span className="font-medium" style={{ fontSize: 11, color: btn.label === 'Message' ? '#E09F4D' : 'rgba(255,226,190,0.6)' }}>
                                    {btn.label}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* ─── Info Rows ─── */}
                    {!isGroup && (
                        <div className="px-3 py-2" style={{ background: '#2a1a0e' }}>
                            {extraInfo.phone && (
                                <div className="info-row-hover flex items-center gap-4">
                                    <Phone className="w-5 h-5 flex-shrink-0" style={{ color: 'rgba(255,226,190,0.35)' }} />
                                    <div>
                                        <div className="font-medium" style={{ fontSize: 14, color: '#FFE2BE' }}>{extraInfo.phone}</div>
                                        <div style={{ fontSize: 12, color: 'rgba(255,226,190,0.4)' }}>Mobile</div>
                                    </div>
                                </div>
                            )}
                            {extraInfo.username && (
                                <div className="info-row-hover flex items-center gap-4">
                                    <AtSign className="w-5 h-5 flex-shrink-0" style={{ color: 'rgba(255,226,190,0.35)' }} />
                                    <div>
                                        <div className="font-medium" style={{ fontSize: 14, color: '#FFE2BE' }}>@{extraInfo.username}</div>
                                        <div style={{ fontSize: 12, color: 'rgba(255,226,190,0.4)' }}>Username</div>
                                    </div>
                                </div>
                            )}
                            {extraInfo.birthday && (
                                <div className="info-row-hover flex items-center gap-4">
                                    <Calendar className="w-5 h-5 flex-shrink-0" style={{ color: 'rgba(255,226,190,0.35)' }} />
                                    <div>
                                        <div className="font-medium" style={{ fontSize: 14, color: '#FFE2BE' }}>
                                            {extraInfo.birthday}{age !== null ? ` (${age} years old)` : ''}
                                        </div>
                                        <div style={{ fontSize: 12, color: 'rgba(255,226,190,0.4)' }}>Birthday</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── Tab Bar (6 tabs, horizontal scroll) ─── */}
                    <div
                        className="flex px-3 pt-2"
                        style={{
                            borderBottom: '1px solid rgba(255,226,190,0.08)',
                            background: 'rgba(42,26,14,0.85)',
                            gap: 4,
                            overflowX: 'auto',
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
                            WebkitOverflowScrolling: 'touch'
                        }}
                    >
                        {tabs.map((tab) => {
                            const count = categorisedItems[tab.key].length;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`profile-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                                >
                                    {tab.label} ({count})
                                </button>
                            );
                        })}
                    </div>

                    {/* ─── Tab Content ─── */}
                    <div className="profile-custom-scroll" style={{ height: 260, overflowY: 'auto', background: '#2a1a0e', padding: 8 }}>

                        {/* PHOTOS */}
                        {activeTab === 'photos' && (
                            categorisedItems.photos.length === 0 ? <EmptyState icon={ImageIcon} label="photos" /> : (
                                <div className="grid grid-cols-3 gap-1" style={{ overflow: 'hidden' }}>
                                    {categorisedItems.photos.map((msg) => (
                                        <div
                                            key={msg.id}
                                            onClick={() => onMediaSelect?.(msg.attachment_ref, 'photo')}
                                            className="media-grid-cell aspect-square rounded-md"
                                            style={{ background: '#3a2212' }}
                                            {...longPressProps(msg.id, msg.conversation_id, 'photo')}
                                        >
                                            <img src={msg.attachment_url} className="w-full h-full object-cover rounded-md" loading="lazy" />
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {/* VIDEOS */}
                        {activeTab === 'videos' && (
                            categorisedItems.videos.length === 0 ? <EmptyState icon={VideoIcon} label="videos" /> : (
                                <div className="grid grid-cols-3 gap-1" style={{ overflow: 'hidden' }}>
                                    {categorisedItems.videos.map((msg) => (
                                        <div
                                            key={msg.id}
                                            onClick={() => onMediaSelect?.(msg.attachment_ref, 'video')}
                                            className="media-grid-cell aspect-square rounded-md"
                                            style={{ background: '#3a2212' }}
                                            {...longPressProps(msg.id, msg.conversation_id, 'video')}
                                        >
                                            <div className="relative w-full h-full">
                                                <video src={msg.attachment_url} className="w-full h-full object-cover rounded-md" preload="metadata" />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-md">
                                                    <Play className="w-6 h-6 text-white fill-white" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {/* FILES */}
                        {activeTab === 'files' && (
                            categorisedItems.files.length === 0 ? <EmptyState icon={FileText} label="files" /> : (
                                <div className="space-y-1">
                                    {categorisedItems.files.map((msg) => {
                                        const fileName = msg.attachment_url?.split('/').pop()?.split('?')[0] || 'File';
                                        return (
                                            <a
                                                key={msg.id}
                                                href={msg.attachment_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                                                style={{ color: '#FFE2BE' }}
                                                onMouseEnter={(e) => (e.currentTarget.style.background = '#3a2212')}
                                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                                {...longPressProps(msg.id, msg.conversation_id, 'file')}
                                            >
                                                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#3a2212', color: '#E09F4D' }}>
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-medium break-all" style={{ fontSize: 13, color: '#FFE2BE', wordBreak: 'break-word' }}>{fileName}</div>
                                                    <div style={{ fontSize: 12, color: 'rgba(255,226,190,0.4)' }}>
                                                        {format(new Date(msg.created_at), 'MMM d, yyyy')}
                                                    </div>
                                                </div>
                                            </a>
                                        );
                                    })}
                                </div>
                            )
                        )}

                        {/* LINKS */}
                        {activeTab === 'links' && (
                            categorisedItems.links.length === 0 ? <EmptyState icon={LinkIcon} label="links" /> : (
                                <div className="space-y-1">
                                    {categorisedItems.links.map((link) => (
                                        <a
                                            key={link.id}
                                            href={link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                                            style={{ color: '#E09F4D' }}
                                            onMouseEnter={(e) => (e.currentTarget.style.background = '#3a2212')}
                                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                            {...longPressProps(link.message_id || link.id, link.conversation_id || '', 'link')}
                                        >
                                            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#3a2212', color: '#E09F4D' }}>
                                                <LinkIcon className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div
                                                    style={{ fontSize: 13, color: '#E09F4D', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                                                >
                                                    {link.url}
                                                </div>
                                                <div style={{ fontSize: 12, color: 'rgba(255,226,190,0.4)' }}>
                                                    {format(new Date(link.created_at), 'MMM d, yyyy')}
                                                </div>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            )
                        )}

                        {/* AUDIO */}
                        {activeTab === 'audio' && (
                            categorisedItems.audio.length === 0 ? <EmptyState icon={Headphones} label="audio" /> : (
                                <div className="space-y-1">
                                    {categorisedItems.audio.map((msg) => {
                                        const fileName = msg.attachment_url?.split('/').pop()?.split('?')[0] || 'Audio';
                                        const isPlaying = playingVoiceId === msg.id;
                                        return (
                                            <div
                                                key={msg.id}
                                                className="p-3 rounded-xl transition-colors"
                                                onMouseEnter={(e) => (e.currentTarget.style.background = '#3a2212')}
                                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                                {...longPressProps(msg.id, msg.conversation_id, 'audio')}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer flex-shrink-0 transition-colors"
                                                        style={{ background: isPlaying ? '#9B5230' : '#E09F4D', color: 'white' }}
                                                        onClick={() => toggleVoice(msg.id, msg.attachment_url)}
                                                    >
                                                        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium" style={{ fontSize: 13, color: '#FFE2BE', wordBreak: 'break-word' }}>{fileName}</div>
                                                        <div style={{ fontSize: 12, color: 'rgba(255,226,190,0.4)' }}>
                                                            {format(new Date(msg.created_at), 'MMM d, yyyy')}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        )}

                        {/* VOICE */}
                        {activeTab === 'voice' && (
                            categorisedItems.voice.length === 0 ? <EmptyState icon={MicIcon} label="voice messages" /> : (
                                <div className="space-y-1">
                                    {categorisedItems.voice.map((msg) => {
                                        const isPlaying = playingVoiceId === msg.id;
                                        return (
                                            <div
                                                key={msg.id}
                                                className="p-3 rounded-xl transition-colors"
                                                onMouseEnter={(e) => (e.currentTarget.style.background = '#3a2212')}
                                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                                {...longPressProps(msg.id, msg.conversation_id, 'voice')}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div
                                                        className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer flex-shrink-0 transition-colors"
                                                        style={{ background: isPlaying ? '#9B5230' : '#E09F4D', color: 'white' }}
                                                        onClick={() => toggleVoice(msg.id, msg.attachment_url)}
                                                    >
                                                        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                                                    </div>
                                                    <div className="flex-1 flex items-center justify-center gap-1 h-8">
                                                        {waveBars.map((bar, i) => (
                                                            <div
                                                                key={i}
                                                                className="wave-bar"
                                                                style={{
                                                                    '--bar-h': bar.h,
                                                                    animationDelay: bar.delay,
                                                                    height: bar.h,
                                                                    animationPlayState: isPlaying ? 'running' : 'paused',
                                                                } as React.CSSProperties}
                                                            />
                                                        ))}
                                                    </div>
                                                    <div className="whitespace-nowrap" style={{ fontSize: 12, color: 'rgba(255,226,190,0.4)' }}>
                                                        {format(new Date(msg.created_at), 'HH:mm')}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        )}
                    </div>
                </div>

                {/* ─── Context Menu ─── */}
                {ctxMenu.visible && (
                    <>
                        <div className="ctx-menu-overlay" onClick={() => setCtxMenu(prev => ({ ...prev, visible: false }))} />
                        <div className="ctx-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
                            <button className="ctx-menu-item" onClick={handleCtxView}>
                                <Eye className="w-4 h-4" style={{ color: '#E09F4D' }} />
                                View in Chat
                            </button>
                            <button className="ctx-menu-item danger" onClick={handleCtxDelete}>
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default ChatMediaGalleryModal;
