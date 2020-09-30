import React, { useState } from "react";
import { connect } from "react-redux";
import { withStyles } from "@material-ui/core/styles";
import { withRoomContext } from "../RoomContext";
import PropTypes from "prop-types";
import { useIntl, FormattedMessage } from "react-intl";
import Dialog from "@material-ui/core/Dialog";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import MuiDialogTitle from "@material-ui/core/DialogTitle";
import MuiDialogContent from "@material-ui/core/DialogContent";
import MuiDialogActions from "@material-ui/core/DialogActions";

import Notifications from "../components/Notifications/Notifications";

const styles = (theme) => ({
  root: {
    display: "flex",
    width: "100%",
    height: "100%",
    backgroundColor: "var(--background-color)",
    backgroundImage: `url(${window.config ? window.config.background : null})`,
    backgroundAttachment: "fixed",
    backgroundPosition: "center",
    backgroundSize: "cover",
    backgroundRepeat: "no-repeat",
  },
  dialogTitle: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  dialogPaper: {
    width: "30vw",
    padding: theme.spacing(2),
    [theme.breakpoints.down("lg")]: {
      width: "40vw",
    },
    [theme.breakpoints.down("md")]: {
      width: "50vw",
    },
    [theme.breakpoints.down("sm")]: {
      width: "70vw",
    },
    [theme.breakpoints.down("xs")]: {
      width: "90vw",
    },
  },
  logo: {
    display: "block",
    paddingBottom: "1vh",
    width: "auto",
    maxHeight: "20vh",
  },
  appTitle: {
    width: "100%",
    textAlign: "center",
  },
  loginButton: {
    position: "absolute",
    right: theme.spacing(2),
    top: theme.spacing(2),
    padding: 0,
  },
  largeIcon: {
    fontSize: "2em",
  },
  largeAvatar: {
    width: 50,
    height: 50,
  },
  green: {
    color: "rgba(0, 153, 0, 1)",
  },
  red: {
    color: "rgba(153, 0, 0, 1)",
  },
});

const DialogTitle = withStyles(styles)((props) => {
  const { children, classes, myPicture, onLogin, loggedIn, ...other } = props;

  return (
    <MuiDialogTitle
      disableTypography
      className={classes.dialogTitle}
      {...other}
    >
      {window.config.logoVertical && (
        <img
          alt="Logo"
          className={classes.logo}
          src={window.config.logoVertical}
        />
      )}

      <Typography className={classes.appTitle} variant="h5">
        {children}
      </Typography>
    </MuiDialogTitle>
  );
});

const DialogContent = withStyles((theme) => ({
  root: {
    padding: theme.spacing(2),
  },
}))(MuiDialogContent);

const DialogActions = withStyles((theme) => ({
  root: {
    margin: 0,
    padding: theme.spacing(1),
  },
}))(MuiDialogActions);

const Login = ({ roomClient, loggedIn, classes, location, history }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const intl = useIntl();
  const roomId = new URLSearchParams(location.search).get("roomId");

  const handleLogin = async () => {
    const logged = await roomClient.login(username, password, roomId);

    if (logged && roomId) {
      history.push(`/${roomId}`);
      return;
    }

    setUsername("");
    setPassword("");
  };

  const handleCancel = () => {
    if (roomId) {
      history.push(`/${roomId}`);
    }
  };

  return (
    <div className={classes.root}>
      <Dialog
        open
        classes={{
          paper: classes.dialogPaper,
        }}
      >
        <DialogTitle>
          {window.config.title ? window.config.title : "Reuniões"}
          <hr />
        </DialogTitle>

        <DialogContent>
          <TextField
            id="username"
            label={intl.formatMessage({
              id: "label.username",
              defaultMessage: "Username",
            })}
            value={username}
            variant="outlined"
            margin="normal"
            onChange={(event) => setUsername(event.target.value)}
            fullWidth
          />

          <TextField
            id="password"
            label={intl.formatMessage({
              id: "label.password",
              defaultMessage: "Password",
            })}
            value={password}
            variant="outlined"
            margin="normal"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            fullWidth
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCancel} variant="contained" color="primary">
            <FormattedMessage id="login.cancel" defaultMessage="Cancel" />
          </Button>

          <Button onClick={handleLogin} variant="contained" color="secondary">
            <FormattedMessage id="login.confirm" defaultMessage="Login" />
          </Button>
        </DialogActions>
      </Dialog>

      <Notifications />
    </div>
  );
};

Login.propTypes = {
  roomClient: PropTypes.any.isRequired,
  loggedIn: PropTypes.bool.isRequired,
  classes: PropTypes.object.isRequired,
  location: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => {
  return {
    room: state.room,
    loggedIn: state.me.loggedIn,
    myPicture: state.me.picture,
  };
};

export default withRoomContext(
  connect(mapStateToProps, null, null, {
    areStatesEqual: (next, prev) => {
      return prev.me.loggedIn === next.me.loggedIn;
    },
  })(withStyles(styles)(Login))
);
