
export default function Button({ className = '', disabled=false, ...props }) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={
        "px-4 py-2 min-h-11 rounded-2xl shadow-sm border text-sm hover:shadow transition disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.99] " +
        className
      }
    />
  )
}
