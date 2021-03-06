/**
 * External dependencies
 */

import React from 'react';
import { translate as __ } from 'lib/locale';
import { connect } from 'react-redux';
import Dropzone from 'react-dropzone';
import Select from 'component/select';
import classnames from 'classnames';

/**
 * Internal dependencies
 */

import { getGroup } from 'state/group/action';
import { nestedGroups } from 'state/group/selector';
import { importFile, clearFile, addFile, loadImporters, pluginImport, exportFile, downloadFile } from 'state/io/action';
import { STATUS_IN_PROGRESS, STATUS_COMPLETE } from 'state/settings/type';
import { getExportUrl } from 'state/io/selector';
import Importer from './importer';
import ExportCSV from 'page/logs/export-csv';
import { LOGS_TYPE_404, LOGS_TYPE_REDIRECT } from 'state/error/type';
import './style.scss';

class ImportExport extends React.Component {
	constructor( props ) {
		super( props );

		this.props.onLoadGroups();
		this.props.onLoadImport();

		this.state = {
			group: 0,
			hover: false,
			module: 'all',
			format: 'json',
		};
	}

	onView = () => {
		this.props.onExport( this.state.module, this.state.format );
	}

	onDownload = () => {
		this.props.onDownloadFile( getExportUrl( this.state.module, this.state.format ) );
	}

	onEnter = () => {
		const { importingStatus } = this.props.io;

		if ( importingStatus !== STATUS_IN_PROGRESS ) {
			this.setState( { hover: true } );
		}
	}

	onLeave = () => {
		this.setState( { hover: false } );
	}

	onImport = () => {
		this.props.onImport( this.props.io.file, this.state.group );
	}

	onCancel = () => {
		this.setState( { hover: false } );
		this.props.onClearFile();
	}

	onInput = event => {
		const { target } = event;

		this.setState( { [ target.name ]: target.value } );

		if ( target.name === 'module' && target.value === 'everything' ) {
			this.setState( { format: 'json' } );
		}
	}

	onDrop = ( accepted ) => {
		const { importingStatus } = this.props.io;

		if ( accepted.length > 0 && importingStatus !== STATUS_IN_PROGRESS ) {
			this.props.onAddFile( accepted[ 0 ] );
		}

		this.setState( { hover: false, group: this.props.group.rows[ 0 ].id } );
	}

	renderGroupSelect() {
		const { rows } = this.props.group;

		return (
			<div className="groups">
				{ __( 'Import to group' ) }	<Select items={ nestedGroups( rows ) } name="group" value={ this.state.group } onChange={ this.onInput } />
			</div>
		);
	}

	renderInitialDrop( open ) {
		return (
			<React.Fragment>
				<h3>{ __( 'Import a CSV, .htaccess, or JSON file.' ) }</h3>
				<p>{ __( "Click 'Add File' or drag and drop here." ) }</p>

				<button type="button" className="button-secondary" onClick={ open }>{ __( 'Add File' ) }</button>
			</React.Fragment>
		);
	}

	renderDropBeforeUpload() {
		const { file } = this.props.io;
		const isJson = file.type === 'application/json';

		return (
			<React.Fragment>
				<h3>{ __( 'File selected' ) }</h3>

				<p><code>{ file.name }</code></p>

				{ ! isJson && this.renderGroupSelect() }

				<button className="button-primary" onClick={ this.onImport }>{ __( 'Upload' ) }</button> &nbsp;
				<button className="button-secondary" onClick={ this.onCancel }>{ __( 'Cancel' ) }</button>
			</React.Fragment>
		);
	}

	renderUploading() {
		const { file } = this.props.io;

		return (
			<React.Fragment>
				<h3>{ __( 'Importing' ) }</h3>

				<p><code>{ file.name }</code></p>

				<div className="is-placeholder">
					<div className="placeholder-loading"></div>
				</div>
			</React.Fragment>
		);
	}

	renderUploaded() {
		const { lastImport } = this.props.io;

		return (
			<React.Fragment>
				<h3>{ __( 'Finished importing' ) }</h3>

				<p>{ __( 'Total redirects imported:' ) } { lastImport }</p>
				{ lastImport === 0 && <p>{ __( 'Double-check the file is the correct format!' ) }</p> }

				<button className="button-secondary" onClick={ this.onCancel }>{ __( 'OK' ) }</button>
			</React.Fragment>
		);
	}

	renderDropzoneContent( props ) {
		const { getInputProps, getRootProps } = props;
		const { hover } = this.state;
		const { importingStatus, file, lastImport } = this.props.io;
		const classes = classnames( {
			dropzone: true,
			'dropzone-dropped': file !== false,
			'dropzone-importing': importingStatus === STATUS_IN_PROGRESS,
			'dropzone-hover': hover,
		} );

		const rootProps = getRootProps( {
			// Disable click and keydown behavior
			onClick: event => event.stopPropagation(),
			onKeyDown: event => {
				if ( event.keyCode === 32 || event.keyCode === 13 ) {
					event.stopPropagation();
				}
			},
		} );
		let content;

		if ( importingStatus === STATUS_IN_PROGRESS ) {
			content = this.renderUploading();
		} else if ( importingStatus === STATUS_COMPLETE && lastImport !== false && file === false ) {
			content = this.renderUploaded();
		} else if ( file === false ) {
			content = this.renderInitialDrop( props.open );
		} else {
			content = this.renderDropBeforeUpload();
		}

		return (
			<div className={ classes } { ... rootProps }>
				<input { ... getInputProps() } />
				{ content }
			</div>
		);
	}

	renderExport( data ) {
		return (
			<div>
				<textarea className="module-export" rows="14" readOnly={ true } value={ data } />
				<input className="button-secondary" type="submit" value={ __( 'Close' ) } onClick={ this.onCancel } />
			</div>
		);
	}

	renderExporting() {
		return (
			<div className="loader-wrapper loader-textarea">
				<div className="placeholder-loading"></div>
			</div>
		);
	}

	doImport = plugin => {
		if ( confirm( __( 'Are you sure you want to import from %s?', { args: plugin.name } ) ) ) {
			this.props.pluginImport( plugin.id );
		}
	}

	renderImporters( importers ) {
		return (
			<div>
				<h3>{ __( 'Plugin Importers' ) }</h3>

				<p>{ __( 'The following redirect plugins were detected on your site and can be imported from.' ) }</p>

				{ importers.map( ( item, pos ) => <Importer plugin={ item } key={ pos } doImport={ this.doImport } /> ) }
			</div>
		);
	}

	render() {
		const { exportData, exportStatus, importers } = this.props.io;

		return (
			<div className="import">
				<h2>{ __( 'Import' ) }</h2>

				<Dropzone
					multiple={ false }
					onDrop={ this.onDrop }
					onDragLeave={ this.onLeave }
					onDragEnter={ this.onEnter }
				>
					{ props => this.renderDropzoneContent( props ) }
				</Dropzone>

				<p>{ __( 'All imports will be appended to the current database.' ) }</p>
				<div className="inline-notice notice-warning">
					<p>
						{ __( '{{strong}}CSV file format{{/strong}}: {{code}}source URL, target URL{{/code}} - and can be optionally followed with {{code}}regex, http code{{/code}} ({{code}}regex{{/code}} - 0 for no, 1 for yes).', {
							components: {
								code: <code />,
								strong: <strong />,
							},
						} ) }
					</p>
				</div>

				<h2>{ __( 'Export' ) }</h2>
				<p>{ __( 'Export to CSV, Apache .htaccess, Nginx, or Redirection JSON (which contains all redirects and groups).' ) }</p>

				<select name="module" onChange={ this.onInput } value={ this.state.module }>
					<option value="0">{ __( 'Everything' ) }</option>
					<option value="1">{ __( 'WordPress redirects' ) }</option>
					<option value="2">{ __( 'Apache redirects' ) }</option>
					<option value="3">{ __( 'Nginx redirects' ) }</option>
				</select>

				<select name="format" onChange={ this.onInput } value={ this.state.format }>
					<option value="csv">{ __( 'CSV' ) }</option>
					<option value="apache">{ __( 'Apache .htaccess' ) }</option>
					<option value="nginx">{ __( 'Nginx rewrite rules' ) }</option>
					<option value="json">{ __( 'Redirection JSON' ) }</option>
				</select>
				&nbsp;
				<button className="button-primary" onClick={ this.onView }>{ __( 'View' ) }</button>
				&nbsp;
				<button className="button-secondary" onClick={ this.onDownload }>{ __( 'Download' ) }</button>

				{ exportStatus === STATUS_IN_PROGRESS && this.renderExporting() }
				{ exportData && exportStatus !== STATUS_IN_PROGRESS && this.renderExport( exportData ) }

				<h2>Export Logs</h2>
				<ExportCSV logType={ LOGS_TYPE_REDIRECT } title={ __( 'Export redirect' ) } /><br />
				<ExportCSV logType={ LOGS_TYPE_404 } title={ __( 'Export 404' ) } />

				{ importers.length > 0 && this.renderImporters( importers ) }
			</div>
		);
	}
}

function mapStateToProps( state ) {
	const { group, io } = state;

	return {
		group,
		io,
	};
}

function mapDispatchToProps( dispatch ) {
	return {
		onLoadGroups: () => {
			dispatch( getGroup() );
		},
		onImport: ( file, groupId ) => {
			dispatch( importFile( file, groupId ) );
		},
		onAddFile: ( file ) => {
			dispatch( addFile( file ) );
		},
		onClearFile: () => {
			dispatch( clearFile() );
		},
		onExport: ( moduleId, moduleType ) => {
			dispatch( exportFile( moduleId, moduleType ) );
		},
		onDownloadFile: url => {
			dispatch( downloadFile( url ) );
		},
		onLoadImport: () => {
			dispatch( loadImporters() );
		},
		pluginImport: id => {
			dispatch( pluginImport( id ) );
		},
	};
}

export default connect(
	mapStateToProps,
	mapDispatchToProps,
)( ImportExport );
