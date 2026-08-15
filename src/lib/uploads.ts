// Image / attachment handling — always local. Files become inline data-URLs
// stored in the document itself, so WorkBase is fully offline with zero backend
// and your data never leaves the machine.

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('Could not read file'))
    r.readAsDataURL(file)
  })
}

/** Read a file into an inline data-URL kept in local storage. */
export async function uploadFile(file: File): Promise<string> {
  return toDataUrl(file)
}
