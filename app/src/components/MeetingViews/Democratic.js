import React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import debounce from 'lodash/debounce';
import { withStyles } from '@material-ui/core/styles';
import Peer from '../Containers/Peer';
import Me from '../Containers/Me';
import HiddenPeers from '../Containers/HiddenPeers';
import ResizeObserver from 'resize-observer-polyfill';

const RATIO = 1.334;
const PADDING_V = 50;
const PADDING_H = 20;

const styles = () =>
	({
		root :
		{
			width          : '100%',
			height         : '100%',
			display        : 'flex',
			flexDirection  : 'row',
			flexWrap       : 'wrap',
			justifyContent : 'center',
			alignItems     : 'center',
			alignContent   : 'center',
			paddingTop     : 40,
			paddingBottom  : 10,
			paddingLeft    : 10,
			paddingRight   : 10
		}
	});

class Democratic extends React.PureComponent
{
	constructor(props)
	{
		super(props);

		this.state = {
			peerWidth  : 400,
			peerHeight : 300
		};

		this.peersRef = React.createRef();
	}

	updateDimensions = debounce(() =>
	{
		if (!this.peersRef.current)
		{
			return;
		}

		const n = this.props.boxes;

		if (n === 0)
		{
			return;
		}

		const width = this.peersRef.current.clientWidth - PADDING_H;
		const height = this.peersRef.current.clientHeight - PADDING_V;

		let x, y, space;

		for (let rows = 1; rows < 100; rows = rows + 1)
		{
			x = width / Math.ceil(n / rows);
			y = x / RATIO;
			if (height < (y * rows))
			{
				y = height / rows;
				x = RATIO * y;
				break;
			}
			space = height - (y * (rows));
			if (space < y)
			{
				break;
			}
		}
		if (Math.ceil(this.state.peerWidth) !== Math.ceil(0.9 * x))
		{
			this.setState({
				peerWidth  : 0.9 * x,
				peerHeight : 0.9 * y
			});
		}
	}, 200);

	componentDidMount()
	{
		window.addEventListener('resize', this.updateDimensions);
		const observer = new ResizeObserver(this.updateDimensions);

		observer.observe(this.peersRef.current);
	}

	componentWillUnmount()
	{
		window.removeEventListener('resize', this.updateDimensions);
	}

	componentDidUpdate()
	{
		this.updateDimensions();
	}

	render()
	{
		const {
			advancedMode,
			peers,
			spotlights,
			spotlightsLength,
			classes
		} = this.props;

		const style =
		{
			'width'  : this.state.peerWidth,
			'height' : this.state.peerHeight
		};

		return (
			<div className={classes.root} ref={this.peersRef}>
				<Me
					advancedMode={advancedMode}
					style={style}
				/>
				{ Object.keys(peers).map((peerName) =>
				{
					if (spotlights.find((spotlightsElement) => spotlightsElement === peerName))
					{
						return (
							<Peer
								key={peerName}
								advancedMode={advancedMode}
								name={peerName}
								style={style}
							/>
						);
					}
					else
					{
						return ('');
					}
				})}
				{ spotlightsLength < Object.keys(peers).length ?
					<HiddenPeers
						hiddenPeersCount={Object.keys(peers).length - spotlightsLength}
					/>
					:null
				}
			</div>
		);
	}
}

Democratic.propTypes =
	{
		advancedMode     : PropTypes.bool,
		peers            : PropTypes.object.isRequired,
		boxes            : PropTypes.number,
		spotlightsLength : PropTypes.number,
		spotlights       : PropTypes.array.isRequired,
		classes          : PropTypes.object.isRequired
	};

const mapStateToProps = (state) =>
{
	const spotlights = state.room.spotlights;
	const spotlightsLength = spotlights ? state.room.spotlights.length : 0;
	const boxes = spotlightsLength + Object.values(state.consumers)
		.filter((consumer) => consumer.source === 'screen').length + Object.values(state.producers)
		.filter((producer) => producer.source === 'screen').length + 1;

	return {
		peers : state.peers,
		boxes,
		spotlights,
		spotlightsLength
	};
};

export default connect(
	mapStateToProps
)(withStyles(styles)(Democratic));