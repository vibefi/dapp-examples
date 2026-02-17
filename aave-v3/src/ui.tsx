import * as React from 'react'

export function Card(props: React.PropsWithChildren<{ title?: string; right?: React.ReactNode }>) {
  return (
    <div className="card">
      {(props.title || props.right) && (
        <div className="cardHeader">
          <div className="cardTitle">{props.title}</div>
          <div>{props.right}</div>
        </div>
      )}
      {props.title && <div className="hr" />}
      {props.children}
    </div>
  )
}

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'danger' }
) {
  const v = props.variant ?? 'default'
  const cls = ['btn', v === 'primary' ? 'primary' : '', v === 'danger' ? 'danger' : '']
    .filter(Boolean)
    .join(' ')
  return <button {...props} className={cls + (props.className ? ` ${props.className}` : '')} />
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={'input' + (props.className ? ` ${props.className}` : '')} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={'select' + (props.className ? ` ${props.className}` : '')} />
}

export function Label(props: React.PropsWithChildren<{ className?: string }>) {
  return <div className={'small muted' + (props.className ? ` ${props.className}` : '')}>{props.children}</div>
}
