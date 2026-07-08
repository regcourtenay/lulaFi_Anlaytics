import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Button, Card, CardActionArea, CardContent, Chip, Container, Grid, Stack,
  TextField, Typography,
} from "@mui/material";

import { useAuth } from "../auth/AuthContext";
import { DEMO_ACCOUNTS } from "../config/demoAccounts";
import { basePath } from "../config/tabs";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [logon, setLogon] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(l = logon, p = passphrase) {
    setBusy(true); setError(null);
    try {
      const user = await login(l.trim(), p.trim());
      nav(basePath(user.userType));
    } catch (e) {
      setError(e.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: 6 }}>
      <Container maxWidth="md">
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", background: "linear-gradient(135deg,#1852c7,#0fa3a3)" }} />
          <Typography variant="h4" fontWeight={800} color="primary.dark">lulaFi Analytics</Typography>
        </Stack>
        <Typography color="text.secondary" mb={3}>One Platform. One Experience. No Repetition. — POC (LULAFI-SDD-ANL-001)</Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Sign in</Typography>
                <Stack spacing={2}>
                  <TextField label="Logon" size="small" value={logon} onChange={(e) => setLogon(e.target.value)} fullWidth />
                  <TextField label="Passphrase" size="small" value={passphrase} onChange={(e) => setPassphrase(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()} fullWidth />
                  {error && <Typography color="error" variant="body2">{error}</Typography>}
                  <Button variant="contained" onClick={() => submit()} disabled={busy || !logon || !passphrase}>Sign in</Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={7}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>Demo accounts (click to sign in)</Typography>
            <Grid container spacing={1.5}>
              {DEMO_ACCOUNTS.map((a) => (
                <Grid item xs={12} sm={6} key={a.logon}>
                  <Card>
                    <CardActionArea onClick={() => { setLogon(a.logon); setPassphrase(a.passphrase); submit(a.logon, a.passphrase); }}>
                      <CardContent sx={{ py: 1.5 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" fontWeight={600}>{a.logon}</Typography>
                          <Chip size="small" color={a.type === "Provider" ? "primary" : "secondary"} label={a.type} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">{a.state}</Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
