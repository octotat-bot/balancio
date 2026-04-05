import React, { forwardRef } from 'react';

export const Input = forwardRef(({
    label,
    error,
    icon: Icon,
    className = '',
    style = {},
    containerStyle = {},
    required = false,
    ...props
}, ref) => {
    return (
        <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...containerStyle }}>
            {label && (
                <label style={{ fontSize: '14px', fontWeight: '500', color: '#EDEAE4' }}>
                    {label}
                    {required && <span style={{ color: '#dc2626', marginLeft: '4px' }}>*</span>}
                </label>
            )}
            <div style={{ position: 'relative' }}>
                <input
                    ref={ref}
                    style={{
                        width: '100%',
                        height: '44px',
                        padding: Icon ? '0 40px 0 40px' : '0 12px',
                        borderRadius: '12px',
                        border: '2px solid',
                        borderColor: error ? '#dc2626' : '#e5e5e5',
                        fontSize: '15px',
                        color: '#EDEAE4',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                        backgroundColor: error ? '#fef2f2' : '#fff',
                        ...style,
                    }}
                    onFocus={(e) => {
                        e.target.style.borderColor = error ? '#dc2626' : '#000000';
                        if (props.onFocus) props.onFocus(e);
                    }}
                    onBlur={(e) => {
                        e.target.style.borderColor = error ? '#dc2626' : '#e5e5e5';
                        if (props.onBlur) props.onBlur(e);
                    }}
                    {...props}
                />
                {Icon && (
                    <div style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none',
                        color: error ? '#dc2626' : '#a3a3a3',
                        display: 'flex',
                        alignItems: 'center',
                    }}>
                        <Icon size={18} />
                    </div>
                )}
            </div>
            {error && (
                <span style={{
                    fontSize: '13px',
                    color: '#dc2626',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    ⚠️ {error}
                </span>
            )}
        </div>
    );
});

Input.displayName = 'Input';
export default Input;
