import { Card, CardContent } from '@/components/ui/card'
import { Clock, Video, GraduationCap, AlertCircle } from 'lucide-react'

interface SummaryStatsProps {
  totalVideos: number
  totalHours: number
  educationalPercent: number
  reviewCount: number
}

export function SummaryStats({
  totalVideos,
  totalHours,
  educationalPercent,
  reviewCount,
}: SummaryStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Total Videos */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Video className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Videos Watched</p>
              <p className="text-2xl font-bold">{totalVideos}</p>
              <p className="text-xs text-gray-500 mt-1">All time</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Hours */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Hours Watched</p>
              <p className="text-2xl font-bold">{totalHours}</p>
              <p className="text-xs text-gray-500 mt-1">All time</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Educational Content */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <GraduationCap className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Educational</p>
              <p className="text-2xl font-bold">{educationalPercent}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Needs Review */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Needs Review</p>
              <p className="text-2xl font-bold">{reviewCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
