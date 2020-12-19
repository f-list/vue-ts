import * as ts from 'typescript';
import {ObjectLiteralExpression} from 'typescript';

function getDecoratorName(decorator: ts.Decorator) {
	return ts.isCallExpression(decorator.expression) ? decorator.expression.expression.getText(decorator.getSourceFile()) : decorator.expression.getText(decorator.getSourceFile());
}

function getDecoratorArgument(decorator: ts.Decorator, index: number) {
	return ts.isCallExpression(decorator.expression) ? decorator.expression.arguments[index] : undefined;
}

const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
	const visitor: ts.Visitor = (node) => {
		const f = context.factory;
		const decorator = node.decorators?.filter(x => getDecoratorName(x) === 'Component')[0];
		if(!decorator) return node;

		const computed: {[key: string]: {get?: ts.AccessorDeclaration, set?: ts.AccessorDeclaration}} = {},
			watch: {[key: string]: ts.ObjectLiteralExpression[]} = {}, hooks: {[key: string]: ts.Expression[]} = {};
		const cls = <ts.ClassDeclaration>node;
		const base = cls.heritageClauses!.filter(x => x.token == ts.SyntaxKind.ExtendsKeyword)[0].types[0];
		const data: ts.PropertyAssignment[] = [], props: ts.PropertyAssignment[] = [], methods: ts.MethodDeclaration[] = [];
		for(const member of cls.members) {
			if(member.modifiers?.some(x => x.kind === ts.SyntaxKind.AbstractKeyword)) continue;
			if(ts.isAccessor(member)) {
				const entry = (computed[member.name!.getText()] ??= {});
				entry[ts.isGetAccessor(member) ? 'get' : 'set'] = member;
			} else if(ts.isPropertyDeclaration(member)) {
				const prop = member.decorators?.filter(x => getDecoratorName(x) === 'Prop')[0];
				if(prop)
					props.push(f.createPropertyAssignment(member.name, getDecoratorArgument(prop, 0) || f.createObjectLiteralExpression()));
				else
					data.push(f.createPropertyAssignment(member.name, member.initializer || f.createIdentifier('undefined')));
			} else if(ts.isMethodDeclaration(member)) {
				function replaceIfSuper(node: ts.Node): ts.Node {
					if(ts.isCallExpression(node) && (ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression))
							&& node.expression.expression.kind === ts.SyntaxKind.SuperKeyword) {
						const methods = f.createPropertyAccessExpression(base.expression, 'methods');
						const access = ts.isPropertyAccessExpression(node.expression) ? f.createPropertyAccessExpression(methods, node.expression.name) : f.createElementAccessExpression(methods, node.expression.argumentExpression);
						node = f.createCallExpression(f.createPropertyAccessExpression(access, 'call'), node.typeArguments, [f.createThis(), ...node.arguments]);
					}
					return ts.visitEachChild(node, replaceIfSuper, context);
				}

				const method = ts.visitEachChild(member, replaceIfSuper, context);
				methods.push(method);
				const hookDecorators = method.decorators?.filter(x => getDecoratorName(x) === 'Hook');
				for(const hook of hookDecorators || []) {
					const name = (<ts.StringLiteral>getDecoratorArgument(hook, 0)).text;
					const entry = (hooks[name] ??= []);
					entry.push(ts.isPrivateIdentifier(method.name) || ts.isIdentifier(method.name) ? f.createPropertyAccessExpression(f.createThis(), method.name) :
						f.createElementAccessExpression(f.createThis(), ts.isComputedPropertyName(method.name) ? method.name.expression : method.name));
				}
				const watches = method.decorators?.filter(x => getDecoratorName(x) === 'Watch');
				for(const watchDecorator of watches || []) {
					const existing = (getDecoratorArgument(watchDecorator, 1) as ObjectLiteralExpression)?.properties || [];
					const data = f.createObjectLiteralExpression([...existing, f.createPropertyAssignment(f.createIdentifier('handler'), f.createStringLiteral(method.name.getText()))]);
					const name = (<ts.StringLiteral>getDecoratorArgument(watchDecorator, 0)).text;
					(watch[name] ??= []).push(data);
				}
				method.decorators = undefined;
			}
		}

		const options = [...((getDecoratorArgument(decorator, 0) as ts.ObjectLiteralExpression)?.properties) || []];
		if(base.expression.getText() !== 'Vue') {
			let mixins = options.find(x => x.name?.getText() === 'mixins');
			if(!mixins) {
				mixins = f.createPropertyAssignment('mixins', f.createArrayLiteralExpression());
				options.push(mixins);
			}
			(((mixins as ts.PropertyAssignment).initializer as ts.ArrayLiteralExpression).elements as unknown as ts.Node[]).push(base.expression);
		}

		function createIfAny<T>(entries: {[key: string]: T}, name: string, iterator: (key: string, value: T) => ts.Expression) {
			const keys = Object.keys(entries);
			if(!keys.length) return;
			options.push(f.createPropertyAssignment(name, f.createObjectLiteralExpression(keys.map(x => f.createPropertyAssignment(f.createStringLiteral(x), iterator(x, entries[x]))))));
		}

		createIfAny(computed, 'computed', (key, value) => {
			if(!value.get) throw new Error('No getter defined for ' + key);
			const prop = [f.createMethodDeclaration(undefined, undefined, undefined, 'get', undefined, undefined, [], undefined, value.get.body)];
			if(value.set)
				prop.push(f.createMethodDeclaration(undefined, undefined, undefined, 'set', undefined, undefined, value.set.parameters, undefined, value.set.body));
			return f.createObjectLiteralExpression(prop);
		});
		createIfAny(watch, 'watch', (_, value) => f.createArrayLiteralExpression(value));
		for(const hook in hooks) {
			const block = hooks[hook].map(x => f.createExpressionStatement(f.createCallExpression(f.createPropertyAccessExpression(x, 'apply'),
				undefined, [f.createThis(), f.createIdentifier('arguments')])));
			options.push(f.createMethodDeclaration(undefined, undefined, undefined, hook, undefined, undefined, [], undefined, f.createBlock(block)));
		}
		if(props.length) options.push(f.createPropertyAssignment('props', f.createObjectLiteralExpression(props)));
		if(methods.length) options.push(f.createPropertyAssignment('methods', f.createObjectLiteralExpression(methods)));
		if(data.length)
			options.push(f.createMethodDeclaration(undefined, undefined, undefined, 'data', undefined, undefined, [], undefined, f.createBlock([f.createReturnStatement(f.createObjectLiteralExpression(data))])));

		const def = f.createVariableStatement([f.createModifier(ts.SyntaxKind.ConstKeyword)], [f.createVariableDeclaration(cls.name!, undefined, undefined, f.createObjectLiteralExpression(options))]);
		if(cls.modifiers?.some(x => x.kind === ts.SyntaxKind.ExportKeyword))
			if(cls.modifiers?.some(x => x.kind === ts.SyntaxKind.DefaultKeyword))
				return [def, f.createExportDefault(cls.name!)];
			else
				return [def, f.createExportDeclaration(undefined, undefined, false, f.createNamedExports([f.createExportSpecifier(undefined, cls.name!)]))];
		else
			return def;
	};

	return (node) => ts.visitEachChild(node, visitor, context);
};

export default transformer;
