import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import * as stateActions from '../../actions/stateActions';
import AppBar from '@material-ui/core/AppBar';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Badge from '@material-ui/core/Badge';
import Chat from './Chat/Chat';
import FileSharing from './FileSharing/FileSharing';
import ParticipantList from './ParticipantList/ParticipantList';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import IconButton from '@material-ui/core/IconButton';

const tabs =
[
	'chat',
	'files',
	'users'
];

const styles = (theme) =>
	({
		root :
		{
			display         : 'flex',
			flexDirection   : 'column',
			width           : '100%',
			height          : '100%',
			backgroundColor : theme.palette.background.paper
		}
	});

class MeetingDrawer extends React.PureComponent
{
	handleChange = (event, value) =>
	{
		this.props.setToolTab(tabs[value]);
	};

	render()
	{
		const {
			currentToolTab,
			unreadMessages,
			unreadFiles,
			closeDrawer,
			classes,
			theme
		} = this.props;

		return (
			<div className={classes.root}>
				<AppBar position='static' color='default'>
					<Tabs
						value={tabs.indexOf(currentToolTab)}
						onChange={this.handleChange}
						indicatorColor='primary'
						textColor='primary'
						variant='fullWidth'
					>
						<Tab
							label={
								<Badge color='secondary' badgeContent={unreadMessages}>
									Chat
								</Badge>
							}
						/>
						<Tab
							label={
								<Badge color='secondary' badgeContent={unreadFiles}>
									File sharing
								</Badge>
							}
						/>
						<Tab label='Participants' />
						<IconButton onClick={closeDrawer}>
							{theme.direction === 'ltr' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
						</IconButton>
					</Tabs>
				</AppBar>
				{currentToolTab === 'chat' && <Chat />}
				{currentToolTab === 'files' && <FileSharing />}
				{currentToolTab === 'users' && <ParticipantList />}
			</div>
		);
	}
}

MeetingDrawer.propTypes =
{
	currentToolTab : PropTypes.string.isRequired,
	setToolTab     : PropTypes.func.isRequired,
	unreadMessages : PropTypes.number.isRequired,
	unreadFiles    : PropTypes.number.isRequired,
	closeDrawer    : PropTypes.func.isRequired,
	classes        : PropTypes.object.isRequired,
	theme          : PropTypes.object.isRequired
};

const mapStateToProps = (state) => ({
	currentToolTab : state.toolarea.currentToolTab,
	unreadMessages : state.toolarea.unreadMessages,
	unreadFiles    : state.toolarea.unreadFiles
});

const mapDispatchToProps = {
	setToolTab : stateActions.setToolTab
};

export default connect(
	mapStateToProps,
	mapDispatchToProps
)(withStyles(styles, { withTheme: true })(MeetingDrawer));