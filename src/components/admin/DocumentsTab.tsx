import React, { useState } from "react";
import { useAdminDocuments, useDeleteDocument, useDocumentAssignments, getDocumentUrl, SharedDocument } from "@/hooks/useSharedDocuments";
import { UploadDocumentModal } from "./UploadDocumentModal";
import { useRole } from "@/contexts/RoleContext";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Upload,
  Search,
  RefreshCw,
  Loader2,
  MoreVertical,
  Download,
  Eye,
  Trash2,
  Users,
  Globe,
  Lock,
  Calendar,
  User
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

// Category Badge
function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    general: "bg-muted text-muted-foreground",
    contract: "bg-blue-100 text-blue-800",
    guide: "bg-green-100 text-green-800",
    policy: "bg-purple-100 text-purple-800",
    invoice: "bg-yellow-100 text-yellow-800",
    report: "bg-orange-100 text-orange-800",
    other: "bg-muted text-muted-foreground",
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${colors[category] || colors.other}`}>
      {category}
    </span>
  );
}

// Document Detail Modal
function DocumentDetailModal({
  document,
  isOpen,
  onClose,
}: {
  document: SharedDocument | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { data: assignments, isLoading } = useDocumentAssignments(document?.id || "");

  if (!document) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase">Title</p>
              <p className="font-medium">{document.title}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Category</p>
              <div className="mt-1">
                <CategoryBadge category={document.category} />
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">File Name</p>
              <p className="text-sm truncate">{document.file_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Size</p>
              <p className="text-sm">
                {document.file_size ? `${(document.file_size / 1024 / 1024).toFixed(2)} MB` : "Unknown"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Visibility</p>
              <p className="text-sm flex items-center gap-1">
                {document.is_public ? (
                  <><Globe className="h-3 w-3" /> Public</>
                ) : (
                  <><Lock className="h-3 w-3" /> Private</>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Uploaded By</p>
              <p className="text-sm truncate">{document.uploaded_by_email}</p>
            </div>
          </div>

          {/* Description */}
          {document.description && (
            <div>
              <p className="text-xs text-muted-foreground uppercase">Description</p>
              <p className="text-sm">{document.description}</p>
            </div>
          )}

          {/* Assignments */}
          {!document.is_public && (
            <div>
              <p className="text-xs text-muted-foreground uppercase flex items-center gap-1 mb-2">
                <Users className="h-3 w-3" />
                Assigned Users ({assignments?.length || 0})
              </p>
              <div className="border rounded-lg max-h-32 overflow-y-auto">
                {isLoading ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : assignments && assignments.length > 0 ? (
                  assignments.map((a) => (
                    <div key={a.id} className="flex items-center justify-between p-2 border-b last:border-0">
                      <span className="text-sm">{a.user_email}</span>
                      <span className="text-xs text-muted-foreground">
                        {a.viewed_at ? "Viewed" : "Not viewed"}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground p-3">No users assigned</p>
                )}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div>
              <p className="text-xs text-muted-foreground uppercase">Uploaded</p>
              <p className="text-sm">
                {format(new Date(document.created_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Last Updated</p>
              <p className="text-sm">
                {format(new Date(document.updated_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Main Documents Tab
export function DocumentsTab() {
  const { toast } = useToast();
  const { isSuperAdmin } = useRole();
  const { data: documents, isLoading, refetch } = useAdminDocuments();
  const deleteMutation = useDeleteDocument();

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedDocument, setSelectedDocument] = useState<SharedDocument | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Filter documents
  const filteredDocuments = (documents || []).filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    const matchesCategory = categoryFilter === "all" || doc.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = [...new Set((documents || []).map((d) => d.category))];

  const handleDownload = async (doc: SharedDocument) => {
    try {
      const url = await getDocumentUrl(doc.file_path);
      if (url) {
        window.open(url, "_blank");
      } else {
        throw new Error("Could not generate download URL");
      }
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      await deleteMutation.mutateAsync(docId);
      toast({
        title: "Document deleted",
        description: "The document has been removed",
      });
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleViewDetails = (doc: SharedDocument) => {
    setSelectedDocument(doc);
    setIsDetailOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Documents</h2>
          <p className="text-muted-foreground">
            Upload and manage documents for users
          </p>
        </div>
        <Button onClick={() => setIsUploadOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{documents?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Total Documents</p>
            </div>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Globe className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {documents?.filter((d) => d.is_public).length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Public</p>
            </div>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Lock className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {documents?.filter((d) => !d.is_public).length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Private</p>
            </div>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {documents?.filter(
                  (d) => new Date(d.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                ).length || 0}
              </p>
              <p className="text-sm text-muted-foreground">This Week</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Documents Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Visibility</TableHead>
              <TableHead>Uploaded By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDocuments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No documents found</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setIsUploadOpen(true)}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload First Document
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              filteredDocuments.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{doc.title}</p>
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">{doc.file_name}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <CategoryBadge category={doc.category} />
                  </TableCell>
                  <TableCell>
                    {doc.is_public ? (
                      <span className="flex items-center gap-1 text-sm text-green-600">
                        <Globe className="h-4 w-4" />
                        Public
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-sm text-orange-600">
                        <Lock className="h-4 w-4" />
                        Private
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground truncate">
                      {doc.uploaded_by_email}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewDetails(doc)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownload(doc)}>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        {isSuperAdmin && (
                          <>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  onSelect={(e) => e.preventDefault()}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Document?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete "{doc.title}" and remove access for all assigned users.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(doc.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Upload Modal */}
      <UploadDocumentModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={() => refetch()}
      />

      {/* Detail Modal */}
      <DocumentDetailModal
        document={selectedDocument}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedDocument(null);
        }}
      />
    </div>
  );
}

export default DocumentsTab;
