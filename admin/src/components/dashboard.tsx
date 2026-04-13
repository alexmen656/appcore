import React, { useEffect, useState } from "react";
import { ApiClient } from "adminjs";
import {
  Box,
  H2,
  H5,
  Text,
  Icon,
  Loader,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Badge,
} from "@adminjs/design-system";

const api = new ApiClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function statusColor(s: string): string {
  const m: Record<string, string> = {
    PENDING: "warning",
    RUNNING: "info",
    COMPLETED: "success",
    FAILED: "danger",
    APPROVED: "info",
    APPLIED: "success",
    REJECTED: "default",
    DEPLOYED: "info",
    EVALUATED: "success",
  };
  return m[s] || "default";
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "gerade eben";
  if (mins < 60) return `vor ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `vor ${days}d`;
  return new Date(d).toLocaleDateString("de-DE");
}

function trunc(s: string | null, n: number): string {
  if (!s) return "\u2014";
  return s.length > n ? s.slice(0, n) + "\u2026" : s;
}

function num(n: number): string {
  return (n || 0).toLocaleString("de-DE");
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const KPI_ITEMS: { key: string; label: string; icon: string }[] = [
  { key: "apps", label: "Apps", icon: "Smartphone" },
  { key: "users", label: "Users", icon: "Users" },
  { key: "teams", label: "Teams", icon: "Briefcase" },
  { key: "keywords", label: "Keywords", icon: "Key" },
  { key: "suggestions", label: "Vorschlaege", icon: "Zap" },
  { key: "experiments", label: "Experiments", icon: "GitBranch" },
  { key: "screenshotJobs", label: "Screenshots", icon: "Camera" },
  { key: "buildJobs", label: "Builds", icon: "Package" },
  { key: "analyticsRecords", label: "Analytics", icon: "TrendingUp" },
  { key: "reviews", label: "Reviews", icon: "Star" },
];

const QUICK_LINKS: { label: string; icon: string; resource: string }[] = [
  { label: "Apps", icon: "Smartphone", resource: "App" },
  { label: "Keywords", icon: "Key", resource: "Keyword" },
  { label: "ASO Experiments", icon: "GitBranch", resource: "AsoExperiment" },
  { label: "Vorschlaege", icon: "Zap", resource: "ASOSuggestion" },
  { label: "Benutzer", icon: "Users", resource: "User" },
  { label: "Screenshot Jobs", icon: "Camera", resource: "ScreenshotJob" },
  { label: "Build Jobs", icon: "Package", resource: "BuildJob" },
  { label: "Analytics", icon: "TrendingUp", resource: "AppStoreAnalytics" },
  { label: "Reviews", icon: "Star", resource: "AppReview" },
  { label: "Metadaten", icon: "FileText", resource: "AppMetadataChange" },
];

// ---------------------------------------------------------------------------
// Dashboard Component
// ---------------------------------------------------------------------------
const Dashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getDashboard()
      .then((res: any) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box flex flexDirection="row" justifyContent="center" py="xxl">
        <Loader />
      </Box>
    );
  }

  if (!data) {
    return (
      <Box p="xl">
        <Text color="error">Daten konnten nicht geladen werden.</Text>
      </Box>
    );
  }

  return (
    <Box p="xl" maxWidth={1200} mx="auto">
      {/* Gradient bar */}
      <Box height={4} bg="primary100" borderRadius="default" mb="xl" />

      {/* Header */}
      <Box mb="xl">
        <H2 color="primary100">Marteso Admin</H2>
        <Text variant="sm" color="grey60">
          ASO Engine — Control Center
        </Text>
      </Box>

      {/* KPI Cards */}
      <Box flex flexDirection="row" flexWrap="wrap" mb="xl" style={{ gap: 12 }}>
        {KPI_ITEMS.map((item) => (
          <Box key={item.key} bg="white" border="default" borderRadius="default" p="lg" style={{ minWidth: 150, maxWidth: 200, flex: "1 1 150px" }}>
            <Box flex flexDirection="row" alignItems="center" mb="sm" style={{ gap: 8 }}>
              <Icon icon={item.icon} size={16} color="grey60" />
              <Text variant="sm" color="grey60" fontWeight="bold" textTransform="uppercase">
                {item.label}
              </Text>
            </Box>
            <Text fontSize={28} fontWeight="bold" color="primary100">
              {num(data[item.key])}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Quick links */}
      <H5 mb="lg" mt="xl">Schnellzugriff</H5>
      <Box flex flexDirection="row" flexWrap="wrap" mb="xl" style={{ gap: 10 }}>
        {QUICK_LINKS.map((link) => (
          <Box
            key={link.resource}
            as="a"
            href={`/admin/resources/${link.resource}`}
            flex
            flexDirection="row"
            alignItems="center"
            bg="white"
            border="default"
            borderRadius="default"
            p="default"
            style={{ gap: 10, textDecoration: "none", color: "#111827", fontSize: 13, fontWeight: 600, minWidth: 160 }}
          >
            <Icon icon={link.icon} size={16} color="primary100" />
            <span>{link.label}</span>
          </Box>
        ))}
      </Box>

      {/* Recent Jobs */}
      {data.recentJobs?.length > 0 && (
        <Box mb="xl">
          <H5 mb="lg">Letzte Jobs</H5>
          <Box bg="white" border="default" borderRadius="default" style={{ overflow: "hidden" }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Typ</TableCell>
                  <TableCell>App</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Branch / Commit</TableCell>
                  <TableCell>Erstellt</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.recentJobs.map((j: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell style={{ fontWeight: 600 }}>{j._type}</TableCell>
                    <TableCell>{j.appName || "\u2014"}</TableCell>
                    <TableCell>
                      <Badge variant={statusColor(j.status)}>{j.status}</Badge>
                    </TableCell>
                    <TableCell style={{ fontFamily: "monospace", fontSize: 12, color: "#8b93a5" }}>
                      {j.branch || ""}
                      {j.commitSha ? ` ${j.commitSha.slice(0, 7)}` : ""}
                    </TableCell>
                    <TableCell style={{ color: "#8b93a5", fontSize: 12 }}>{timeAgo(j.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Box>
      )}

      {/* Recent Experiments */}
      {data.recentExperiments?.length > 0 && (
        <Box mb="xl">
          <H5 mb="lg">Letzte ASO Experiments</H5>
          <Box bg="white" border="default" borderRadius="default" style={{ overflow: "hidden" }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>App</TableCell>
                  <TableCell>Typ</TableCell>
                  <TableCell>Von / Nach</TableCell>
                  <TableCell>Confidence</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Erstellt</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.recentExperiments.map((e: any, i: number) => {
                  const conf = Math.round((e.confidence || 0) * 100);
                  const cc = conf >= 80 ? "success" : conf >= 50 ? "warning" : "danger";
                  return (
                    <TableRow key={i}>
                      <TableCell style={{ fontWeight: 500 }}>{e.app?.name || "\u2014"}</TableCell>
                      <TableCell>{(e.type || "").replace(/_/g, " ")}</TableCell>
                      <TableCell>
                        <Text variant="sm" color="grey60" as="span">{trunc(e.fromValue, 18)}</Text>
                        <Text variant="sm" color="grey40" as="span" mx="sm">&rarr;</Text>
                        <Text variant="sm" as="span" fontWeight="bold">{trunc(e.toValue, 18)}</Text>
                      </TableCell>
                      <TableCell>
                        <Badge variant={cc}>{conf}%</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusColor(e.status)}>{e.status}</Badge>
                      </TableCell>
                      <TableCell style={{ color: "#8b93a5", fontSize: 12 }}>{timeAgo(e.createdAt)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Box>
      )}

      {/* Recent Apps */}
      {data.recentApps?.length > 0 && (
        <Box mb="xl">
          <H5 mb="lg">Kuerzlich aktualisierte Apps</H5>
          <Box bg="white" border="default" borderRadius="default" style={{ overflow: "hidden" }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Bundle ID</TableCell>
                  <TableCell>Land</TableCell>
                  <TableCell>Eigene App</TableCell>
                  <TableCell>Aktualisiert</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.recentApps.map((a: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell style={{ fontWeight: 600 }}>{a.name}</TableCell>
                    <TableCell style={{ fontFamily: "monospace", fontSize: 12, color: "#8b93a5" }}>
                      {a.bundleId}
                    </TableCell>
                    <TableCell>{(a.country || "\u2014").toUpperCase()}</TableCell>
                    <TableCell>
                      <Badge variant={a.isOwnApp ? "success" : "default"}>
                        {a.isOwnApp ? "Ja" : "Nein"}
                      </Badge>
                    </TableCell>
                    <TableCell style={{ color: "#8b93a5", fontSize: 12 }}>{timeAgo(a.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Box>
      )}

      <Box py="xl" style={{ textAlign: "center" }}>
        <Text variant="sm" color="grey60">
          Marteso ASO Engine — Admin Dashboard
        </Text>
      </Box>
    </Box>
  );
};

export default Dashboard;
