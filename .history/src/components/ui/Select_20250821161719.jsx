
export default function Select(props) {
  return (
    <select
      {...props}
      className={
        "w-full border rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-black/10 " +
        (props.className || "")
      }
    />
  )
}
