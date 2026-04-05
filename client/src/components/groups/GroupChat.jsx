import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import { Send } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { formatDate } from '../../utils/helpers';

export function GroupChat({ groupId }) {
    const { user } = useAuthStore();
    const {
        messages,
        joinGroup,
        leaveGroup,
        sendMessage,
        sendTyping,
        typingUsers,
        connect,
        disconnect,
        isConnected,
        isLoading
    } = useChatStore();

    const [input, setInput] = useState('');
    const [isTypingTimeout, setIsTypingTimeout] = useState(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        connect();
        return () => disconnect();
    }, []); // Run once on mount

    useEffect(() => {
        if (isConnected && groupId && user) {
            joinGroup(groupId, user._id);
            return () => {
                leaveGroup(groupId);
            };
        }
    }, [isConnected, groupId, user?._id]); // Re-join if connection resets or group changes

    // Auto-scroll to bottom of list (which is actually top physically if we use flex-col-reverse, 
    // but usually easier to assume standard order and scrollIntoView)
    // Actually, store appends new messages to TOP, so we might want flex-col-reverse.
    // "messages: [message, ...state.messages]" -> Newest first.
    // So we should iterate messages in reverse or use flex-col-reverse.

    const handleSend = (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        sendMessage(groupId, user._id, input);
        setInput('');

        // Clear typing status immediately
        if (isTypingTimeout) clearTimeout(isTypingTimeout);
        sendTyping(groupId, user._id, user.name, false);
    };

    const handleInputChange = (e) => {
        setInput(e.target.value);

        // Debounce typing indicator
        sendTyping(groupId, user._id, user.name, true);

        if (isTypingTimeout) clearTimeout(isTypingTimeout);

        const timeout = setTimeout(() => {
            sendTyping(groupId, user._id, user.name, false);
        }, 2000); // Stop typing after 2 seconds of inactivity

        setIsTypingTimeout(timeout);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '600px', backgroundColor: '#f9f9f9', borderRadius: '16px', overflow: 'hidden', border: '1px solid #252530' }}>

            {/* Messages Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column-reverse', gap: '16px' }}>
                {/* Typing Indicator */}
                {Object.keys(typingUsers).length > 0 && (
                    <div style={{ alignSelf: 'flex-start', marginLeft: '48px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#8A8680', fontStyle: 'italic' }}>
                            {Object.values(typingUsers).map(u => u.userName).join(', ')} is typing...
                        </span>
                    </div>
                )}

                {messages.length === 0 && !isLoading && (
                    <div style={{ textAlign: 'center', color: '#6A6763', marginTop: 'auto', marginBottom: 'auto' }}>
                        <p>No messages yet. Start the conversation!</p>
                    </div>
                )}

                {messages.map((msg, index) => {
                    const isMe = msg.sender?._id === user?._id || msg.sender === user?._id;
                    const showAvatar = index === messages.length - 1 || messages[index + 1]?.sender?._id !== msg.sender?._id;

                    return (
                        <div
                            key={msg._id || index}
                            style={{
                                display: 'flex',
                                alignItems: 'flex-end',
                                gap: '8px',
                                alignSelf: isMe ? 'flex-end' : 'flex-start',
                                maxWidth: '70%'
                            }}
                        >
                            {!isMe && (
                                <div style={{ width: '32px', flexShrink: 0 }}>
                                    {showAvatar ? <Avatar name={msg.sender?.name} size="sm" /> : null}
                                </div>
                            )}

                            <div>
                                {!isMe && showAvatar && (
                                    <p style={{ margin: '0 0 2px 4px', fontSize: '11px', color: '#8A8680' }}>
                                        {msg.sender?.name}
                                    </p>
                                )}
                                <div style={{
                                    padding: '10px 14px',
                                    borderRadius: '16px',
                                    backgroundColor: isMe ? '#0a0a0a' : '#fff',
                                    color: isMe ? '#fff' : '#0a0a0a',
                                    border: isMe ? 'none' : '1px solid #e5e5e5',
                                    borderBottomRightRadius: isMe ? '4px' : '16px',
                                    borderBottomLeftRadius: !isMe ? '4px' : '16px',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                }}>
                                    <p style={{ margin: 0, fontSize: '14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                        {msg.content}
                                    </p>
                                </div>
                                <p style={{
                                    margin: '2px 0 0 0',
                                    fontSize: '10px',
                                    color: '#6A6763',
                                    textAlign: isMe ? 'right' : 'left',
                                    paddingRight: isMe ? '4px' : 0,
                                    paddingLeft: !isMe ? '4px' : 0
                                }}>
                                    {formatDate(msg.createdAt, 'time')}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Input Area */}
            <form
                onSubmit={handleSend}
                style={{
                    padding: '16px',
                    backgroundColor: '#131316',
                    borderTop: '1px solid #252530',
                    display: 'flex',
                    gap: '12px'
                }}
            >
                <input
                    value={input}
                    onChange={handleInputChange}
                    placeholder="Type a message..."
                    style={{
                        flex: 1,
                        padding: '12px 16px',
                        borderRadius: '24px',
                        border: '1px solid #252530',
                        outline: 'none',
                        fontSize: '14px',
                        backgroundColor: '#f9f9f9',
                        transition: 'all 0.2s'
                    }}
                    onFocus={(e) => e.target.style.backgroundColor = '#fff'}
                    onBlur={(e) => e.target.style.backgroundColor = '#f9f9f9'}
                />
                <Button
                    type="submit"
                    disabled={!input.trim() || !isConnected}
                    style={{ borderRadius: '50%', padding: '12px', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    <Send size={20} style={{ marginLeft: '-2px' }} />
                </Button>
            </form>
        </div>
    );
}
