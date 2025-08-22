
export default function IconBtn({ className = '', ...props }) {
  return (
    <button
      {...props}
      className={"grid place-items-center min-h-11 min-w-11 rounded-2xl border shadow-sm active:scale-[0.98] " + className}
    />
  )
}
