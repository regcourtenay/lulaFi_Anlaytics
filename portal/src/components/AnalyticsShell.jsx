import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import LogoutIcon from "@mui/icons-material/Logout";
import PollOutlinedIcon from "@mui/icons-material/PollOutlined";
import {
  AppBar, Avatar, Box, Chip, Drawer, IconButton, List, ListItemButton, ListItemIcon,
  ListItemText, Menu, MenuItem, Tab, Tabs, Toolbar, Typography,
} from "@mui/material";

import { useAuth } from "../auth/AuthContext";
import { FilterProvider } from "./filterState";
import { TAB_META, basePath } from "../config/tabs";

const DRAWER = 240;

export default function AnalyticsShell() {
  const { user, context, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [menuEl, setMenuEl] = useState(null);
  const base = basePath(user.userType);

  const modules = context?.modules || ["overview"];
  const currentSub = loc.pathname.replace(base, "").replace(/^\//, "").split("/")[0] || "";
  const activeKey = modules.find((m) => TAB_META[m]?.sub === currentSub) || modules[0];

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Drawer variant="permanent" sx={{ width: DRAWER, flexShrink: 0, [`& .MuiDrawer-paper`]: { width: DRAWER, boxSizing: "border-box" } }}>
        <Toolbar sx={{ px: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ width: 30, height: 30, borderRadius: "8px", background: "linear-gradient(135deg,#1852c7,#0fa3a3)" }} />
            <Typography variant="h6" fontWeight={800} color="primary.dark">lulaFi</Typography>
          </Box>
        </Toolbar>
        <List>
          <ListItemButton selected aria-current="page">
            <ListItemIcon><PollOutlinedIcon color="primary" /></ListItemIcon>
            <ListItemText primary="Analytics" primaryTypographyProps={{ fontWeight: 600 }} />
          </ListItemButton>
        </List>
        <Box sx={{ mt: "auto", p: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block">Scope</Typography>
          <Chip size="small" color={user.userType === "provider" ? "primary" : "secondary"}
            label={user.userType === "provider" ? (user.providerName || "Provider realm") : "Global (platform)"} />
        </Box>
      </Drawer>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Toolbar>
            <Typography variant="subtitle1" fontWeight={700} color="primary.dark" sx={{ flexGrow: 1 }}>
              {user.userType === "provider" ? "Provider Analytics" : "lulaFi Admin Analytics"}
            </Typography>
            <Chip size="small" variant="outlined" label="production" sx={{ mr: 2 }} />
            <IconButton onClick={(e) => setMenuEl(e.currentTarget)} size="small">
              <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main", fontSize: 14 }}>
                {user.displayName?.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </Avatar>
            </IconButton>
            <Menu open={!!menuEl} anchorEl={menuEl} onClose={() => setMenuEl(null)}>
              <MenuItem disabled>
                <Box>
                  <Typography variant="body2" fontWeight={600}>{user.displayName}</Typography>
                  <Typography variant="caption" color="text.secondary">{user.logon} · {user.seededStateLabel}</Typography>
                </Box>
              </MenuItem>
              <MenuItem onClick={logout}><LogoutIcon fontSize="small" style={{ marginRight: 8 }} /> Sign out</MenuItem>
            </Menu>
          </Toolbar>
          <Tabs value={activeKey} variant="scrollable" scrollButtons="auto" sx={{ px: 2, minHeight: 44 }}
            onChange={(_e, key) => nav(`${base}${TAB_META[key].sub ? `/${TAB_META[key].sub}` : ""}`)}>
            {modules.filter((m) => TAB_META[m]).map((m) => (
              <Tab key={m} value={m} label={TAB_META[m].label} sx={{ minHeight: 44, textTransform: "none", fontWeight: 600 }} />
            ))}
          </Tabs>
        </AppBar>

        <Box component="main" sx={{ p: { xs: 2, md: 3 } }}>
          <FilterProvider defaultTimeZone={context?.defaultTimeZone}>
            <Outlet />
          </FilterProvider>
        </Box>
      </Box>
    </Box>
  );
}
