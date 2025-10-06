'use client'

import { MoreVertical, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/frontend/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/frontend/components/ui/dropdown-menu'
import { useRouter } from 'next/navigation'
import { deleteChild } from '@/frontend/lib/onboarding/actions'
import { useState } from 'react'

interface ChildCardMenuProps {
  childId: string
  childName: string
}

export function ChildCardMenu({ childId, childName }: ChildCardMenuProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`Are you sure you want to remove ${childName}? This action cannot be undone.`)) {
      return
    }

    setIsDeleting(true)
    const result = await deleteChild(childId)

    if (result.error) {
      alert(`Error: ${result.error}`)
      setIsDeleting(false)
    } else {
      // Success - the page will refresh automatically due to revalidatePath
    }
  }

  function handleEdit() {
    router.push(`/edit/${childId}`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isDeleting}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleEdit} className="cursor-pointer">
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleDelete}
          className="cursor-pointer text-red-600 focus:text-red-600"
          disabled={isDeleting}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {isDeleting ? 'Removing...' : 'Remove'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
