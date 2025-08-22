
export default function Input(props) {
  return (
    <input
      {...props}
      className={
        "w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10 " +
        (props.className || "")
      }
    />
  )
}
