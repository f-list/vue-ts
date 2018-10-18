import Vue, {ComponentOptions, PropOptions, WatchOptions, VueConstructor} from 'vue';

export declare function Component(options: ComponentOptions<Vue>): <V extends VueConstructor>(target: V) => V;
export declare function Component<V extends VueConstructor>(target: V): V;

declare const Prop: PropertyDecorator & ((options?: PropOptions) => PropertyDecorator);

export declare function Watch(expression: string, options?: WatchOptions): MethodDecorator;

export declare function Hook(name: 'beforeCreate' | 'created' | 'beforeMount' | 'mounted' | 'beforeDestroy' | 'destroyed' | 'beforeUpdate' | 'updated' | 'activated' | 'deactivated' | 'render' | 'errorCaptured'): MethodDecorator;

export {Prop}