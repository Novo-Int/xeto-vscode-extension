/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate } from './helper';

suite('Should get diagnostics', () => {
	const docUri = getDocUri('diagnostics.pog');

	test('Diagnoses defs', async () => {
		await testDiagnostics(docUri, [
			{ message: 'Duplicate slot name Def at line: 5, col: 1', range: toRange(4, 4, 4, 5), severity: vscode.DiagnosticSeverity.Error, source: 'ex' },
			{ message: 'Duplicate slot name Def at line: 1, col: 1', range: toRange(0, 14, 0, 17), severity: vscode.DiagnosticSeverity.Error, source: 'ex' },
			{ message: 'Expecting proto body: line: 4, col: 1', range: toRange(0, 18, 0, 20), severity: vscode.DiagnosticSeverity.Error, source: 'ex' }
		]);
	});
});

function toRange(sLine: number, sChar: number, eLine: number, eChar: number) {
	const start = new vscode.Position(sLine, sChar);
	const end = new vscode.Position(eLine, eChar);
	return new vscode.Range(start, end);
}

async function testDiagnostics(docUri: vscode.Uri, expectedDiagnostics: vscode.Diagnostic[]) {
	await activate(docUri);

	const actualDiagnostics = vscode.languages.getDiagnostics(docUri);

	console.log(actualDiagnostics);

	assert.equal(actualDiagnostics.length, expectedDiagnostics.length);

	/*
	expectedDiagnostics.forEach((expectedDiagnostic, i) => {
		const actualDiagnostic = actualDiagnostics[i];
		assert.equal(actualDiagnostic.message, expectedDiagnostic.message);
		assert.deepEqual(actualDiagnostic.range, expectedDiagnostic.range);
		assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity);
	});
	*/
}